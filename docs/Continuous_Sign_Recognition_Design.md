# Continuous Sign Recognition - Architecture Design

## 1. Problem Statement

The current implementation supports two interaction modes:
1. **Auto pause-detection**: motion-based segmentation. Unreliable: frames captured include hand-raise/drop garbage, model receives mixed transition + sign frames.
2. **Manual capture**: 1s countdown + 2s fixed window. Accurate but disrupts natural conversation.

Goal: enable **near-real-time continuous recognition** so a user can sign multiple words sequentially without manual triggers, mirroring the flow of normal sign communication.

The base model (Kaggle GISLR 1st place, 250 ASL signs) is trained on **isolated** clips. Continuous Sign Language Recognition (CSLR) is a research-grade problem - no production-ready open model exists. The practical industry approach is to wrap an isolated classifier with a sliding-window inference pipeline plus stateful gating.

## 2. Design Principles

1. **Separation of concerns**: recognition engine is framework-agnostic. React hooks and UI are thin wrappers.
2. **Pure functions where possible**: landmark math, smoothing, state transitions are unit-testable.
3. **Single source of truth for tunables**: all thresholds in one constants file.
4. **Observability first**: dev overlay surfaces internal state for tuning.
5. **No incremental hacks**: replace pause-detection entirely. Manual mode kept only as a deterministic fallback.

## 3. High-Level Architecture

```
+------------------------------------+
|  WebcamCapture.tsx (React UI)      |
|  - Video element                   |
|  - Canvas overlay                  |
|  - Mode toggle (Continuous/Manual) |
|  - Dev overlay (debug panel)       |
+----------------+-------------------+
                 |
                 v
+------------------------------------+
|  useSignRecognition (React hook)   |
|  - Wires MediaPipe -> Engine       |
|  - Manages lifecycle               |
|  - Exposes state + emissions       |
+----------------+-------------------+
                 |
                 v
+------------------------------------+
|  RecognitionEngine (pure TS class) |
|  - Ring buffer (LandmarkBuffer)    |
|  - State machine                   |
|  - Inference scheduler             |
|  - EMA smoother                    |
|  - Stability gate                  |
|  - Cooldown manager                |
|  - Hand-presence gate              |
+----------------+-------------------+
                 |
                 v
+------------------------------------+
|  Backend POST /sign-to-text        |
+------------------------------------+
```

## 4. Module Breakdown

### 4.1 `lib/sign-recognition/constants.ts`

All tunable parameters in one place. Values from research (EMNLP 2024 paper + practitioner patterns).

```ts
export const RECOGNITION_CONFIG = {
  // Landmark layout (matches Kaggle GISLR model)
  FACE_LANDMARKS: 468,
  LEFT_HAND_LANDMARKS: 21,
  POSE_LANDMARKS: 33,
  RIGHT_HAND_LANDMARKS: 21,
  TOTAL_LANDMARKS: 543,

  // Buffer
  BUFFER_SIZE: 48,                  // ~1.6s at 30fps
  TARGET_FPS: 30,                   // Resample to this rate

  // Inference scheduling
  INFERENCE_INTERVAL_FRAMES: 5,     // Run model every 5 captured frames (~6Hz)

  // Confidence and smoothing
  EMA_ALPHA: 0.4,                   // Softmax EMA coefficient
  CONFIDENCE_THRESHOLD: 0.5,        // Min EMA prob to emit
  STABILITY_TICKS: 3,               // Argmax must be stable for N ticks
  EARLY_BREAK_CONFIDENCE: 0.85,     // During cooldown, allow different sign

  // Gating
  HAND_PRESENCE_RATIO: 0.5,         // Min % of buffer with hand visible
  IDLE_HANDS_GONE_MS: 500,          // Hands absent this long => IDLE
  WATCHING_HANDS_PRESENT_MS: 200,   // Hands present this long => WATCHING

  // Cooldown
  COOLDOWN_MS: 500,                 // Block re-emit after sign emitted
  REARM_LOW_CONFIDENCE: 0.3,        // EMA must drop below this to re-arm same sign
  REARM_LOW_CONFIDENCE_MS: 150,     // For this duration

  // Manual mode
  MANUAL_COUNTDOWN_MS: 1000,
  MANUAL_CAPTURE_MS: 2000,
};
```

### 4.2 `lib/sign-recognition/landmark-extractor.ts`

Pure function: MediaPipe Holistic results -> Float32Array(543 * 3) with NaN for missing landmarks. Already implemented; extract from current code.

### 4.3 `lib/sign-recognition/landmark-buffer.ts`

Ring buffer using a single pre-allocated `Float32Array`. No allocation per frame. O(1) push/iterate.

```ts
export class LandmarkBuffer {
  private data: Float32Array;       // pre-allocated, capacity * frameSize
  private writeIdx: number = 0;
  private filled: boolean = false;

  constructor(public capacity: number, public frameSize: number);

  push(frame: Float32Array): void;   // copy into ring slot
  size(): number;                    // current frame count
  isFull(): boolean;
  toArray(): Float32Array[];         // ordered oldest -> newest, for backend POST
  clear(): void;

  /** Hand presence check: % of frames where at least one hand has any non-NaN landmark */
  handPresenceRatio(handStartIdx: number, handEndIdx: number): number;
}
```

### 4.4 `lib/sign-recognition/ema-smoother.ts`

Per-class softmax EMA:

```ts
export class SoftmaxEMA {
  private smoothed: Float32Array | null = null;
  constructor(private numClasses: number, private alpha: number);

  update(softmax: number[] | Float32Array): void;
  topK(k: number): Array<{ index: number; prob: number }>;
  argmax(): { index: number; prob: number };
  reset(): void;
}
```

### 4.5 `lib/sign-recognition/recognition-engine.ts`

The state machine + scheduler. Framework-agnostic. Constructor takes a callback for inference (so it can be unit tested with a mock).

```ts
export type EngineState = 'IDLE' | 'WATCHING' | 'INFERRING' | 'EMITTING' | 'COOLDOWN';

export interface SignEmission {
  sign: string;
  confidence: number;
  timestamp: number;
}

export interface EngineDebugInfo {
  state: EngineState;
  bufferSize: number;
  handPresence: number;
  emaTopK: Array<{ sign: string; prob: number }>;
  stableTicks: number;
  cooldownRemainingMs: number;
}

export type InferenceFn = (frames: Float32Array[]) => Promise<{
  top_5: Array<{ sign: string; confidence: number }>;
  raw_probs?: Float32Array;
}>;

export class RecognitionEngine {
  constructor(
    private config: RecognitionConfig,
    private inferenceFn: InferenceFn,
    private callbacks: {
      onEmit: (e: SignEmission) => void;
      onStateChange?: (s: EngineState) => void;
      onDebug?: (d: EngineDebugInfo) => void;
    }
  );

  /** Called per captured frame (typically 30Hz) */
  pushFrame(frame: Float32Array, hasHands: boolean, timestampMs: number): void;

  /** Returns current debug snapshot */
  getDebug(): EngineDebugInfo;

  reset(): void;
}
```

#### State Transitions

```
IDLE
  hands present for WATCHING_HANDS_PRESENT_MS -> WATCHING (clear buffer)

WATCHING
  buffer full AND hand presence ratio >= HAND_PRESENCE_RATIO -> INFERRING
  hands absent for IDLE_HANDS_GONE_MS -> IDLE

INFERRING (per inference tick)
  schedule inference, await result
  update EMA with result
  if EMA[argmax] >= CONFIDENCE_THRESHOLD AND argmax stable for STABILITY_TICKS:
    emit -> EMITTING
  if hands absent for IDLE_HANDS_GONE_MS -> IDLE

EMITTING
  fire onEmit, immediately -> COOLDOWN (start timer)

COOLDOWN
  keep buffering, keep inferring, keep updating EMA
  if EMA[different argmax] >= EARLY_BREAK_CONFIDENCE -> EMITTING
  if EMA[last emitted argmax] < REARM_LOW_CONFIDENCE for REARM_LOW_CONFIDENCE_MS -> WATCHING
  if cooldown timer expires -> WATCHING
  if hands absent for IDLE_HANDS_GONE_MS -> IDLE
```

#### Inference Scheduling

The engine maintains a frame counter. Every `INFERENCE_INTERVAL_FRAMES`, schedule inference. Inference is async; ignore in-flight scheduling collisions (drop new tick if previous still running). State machine receives result when it resolves.

### 4.6 React Hook: `app/hooks/useSignRecognition.ts`

```ts
export function useSignRecognition(opts: {
  enabled: boolean;
  mode: 'continuous' | 'manual';
  onEmit: (e: SignEmission) => void;
}): {
  state: EngineState;
  debug: EngineDebugInfo | null;
  pushFrame: (results: HolisticResults, ts: number) => void;
  triggerManualRecord: () => Promise<void>;
};
```

Wraps the engine for React. Constructs once via `useMemo`. Exposes pushFrame for the MediaPipe results callback to call.

### 4.7 React Hook: `app/hooks/useMediaPipeHolistic.ts`

Encapsulates MediaPipe lifecycle (init once, reuse, attach onResults). Returns:

```ts
{
  start: (videoEl, onResults) => Promise<void>;
  stop: () => void;
  isReady: boolean;
}
```

### 4.8 UI: `app/components/WebcamCapture.tsx`

Thin component. Wires hooks, renders video + canvas + controls + dev overlay. No business logic.

### 4.9 UI: `app/components/RecognitionDevOverlay.tsx`

Debug panel showing:
- Current state badge
- Buffer fill bar
- Hand presence %
- Live top-5 EMA probabilities
- Stability counter
- Cooldown remaining

Toggleable via a switch in the parent component.

## 5. Data Flow (Continuous Mode)

```
30Hz: Webcam frame
  -> MediaPipe Holistic (in-browser)
    -> onResults callback
      -> useSignRecognition.pushFrame(results, ts)
        -> extractLandmarks(results) -> Float32Array(1629)
        -> hasHands = check landmarks
        -> engine.pushFrame(frame, hasHands, ts)
          -> ringBuffer.push(frame)
          -> stateMachine.update(hasHands, ts)
          -> if INFERRING + scheduled: inferenceFn(buffer.toArray())
            -> backend POST /sign-to-text
            -> response: top_5 + softmax probs
            -> ema.update(probs)
            -> stateMachine.processInference(ema)
              -> maybe transition to EMITTING
                -> callbacks.onEmit({ sign, confidence, ts })
```

## 6. Manual Mode

State machine bypassed. UI calls `triggerManualRecord()`:
1. Show countdown (1s)
2. Set engine in pure-collect mode for `MANUAL_CAPTURE_MS`
3. Send full window to backend
4. Emit single result

This is a deterministic fallback, useful when continuous mode mis-fires or for confidence-critical use cases.

## 7. Backend Changes

The endpoint `/sign-to-text` already returns `top_5` with softmax confidences. To support EMA in the engine cleanly, we need the **full 250-class probability vector** so the engine can track EMA per class.

Add to backend response:
```json
{
  "sign": "...",
  "confidence": 0.92,
  "top_5": [...],
  "all_probs": [0.001, 0.005, ..., 0.92, ...],  // length 250
  "success": true
}
```

This adds ~2-3KB per response (negligible vs the multi-MB landmark payload).

Alternative: track top-K EMA only on the engine side using top_5. Simpler but loses cross-emission smoothing fidelity. Start with full vector approach.

## 8. Testing Strategy

### 8.1 Unit Tests (engine, pure logic)
- LandmarkBuffer: push/size/full/toArray/clear semantics
- SoftmaxEMA: update/argmax/reset
- RecognitionEngine state transitions: simulate frame sequences with mock inferenceFn

### 8.2 Offline Replay Test
Python script:
1. Take a long continuous ASL video
2. Run MediaPipe Holistic, save all landmark frames + timestamps
3. Replay through a TS engine simulator (or Python port of the state machine)
4. Verify emission sequence matches expected gloss

If we don't port the state machine to Python, we can write a Node.js script that imports the engine module and replays landmarks.

### 8.3 Live Browser Test
Start dev server, sign multiple words consecutively, observe dev overlay, tune thresholds.

## 9. Migration Plan

1. Build new modules in `lib/sign-recognition/` (no changes to existing component yet)
2. Port `extractLandmarks` from `WebcamCapture.tsx` to a shared util
3. Build engine + hooks
4. Update backend to return `all_probs`
5. Replace `WebcamCapture.tsx` body with hooks-based version
6. Keep manual mode as a toggle
7. Add dev overlay
8. Tune live

## 10. Tunable Thresholds Reference

These are starting values from research. Expect to adjust during live testing.

| Param | Initial | Range | Effect |
|-------|---------|-------|--------|
| BUFFER_SIZE | 48 | 30-90 | Larger = more context, more lag |
| INFERENCE_INTERVAL_FRAMES | 5 | 3-10 | Lower = more responsive, more CPU |
| EMA_ALPHA | 0.4 | 0.2-0.6 | Higher = faster response, less smoothing |
| CONFIDENCE_THRESHOLD | 0.5 | 0.4-0.8 | Higher = fewer emissions, less false positives |
| STABILITY_TICKS | 3 | 2-5 | Higher = more confident, more lag |
| HAND_PRESENCE_RATIO | 0.5 | 0.3-0.7 | Higher = stricter, fewer false positives |
| COOLDOWN_MS | 500 | 300-1500 | Higher = prevents rapid re-emit |

## 11. Out of Scope

- Real CSLR model (requires retraining on continuous data)
- Multi-sign sentences with grammar (requires language model)
- Two-hand vs one-hand distinction beyond what model provides
- Sign-to-text translation (this is sign-to-gloss only; gloss to English requires NLP layer that we already have inverse of)
