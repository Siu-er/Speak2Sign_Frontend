/**
 * RecognitionEngine: framework-agnostic continuous sign recognition.
 *
 * State machine:
 *   IDLE -> WATCHING (hands present long enough)
 *   WATCHING -> INFERRING (buffer full + hand-presence ratio met)
 *   INFERRING -> EMITTING (EMA confidence + stability satisfied)
 *   EMITTING -> COOLDOWN (immediate)
 *   COOLDOWN -> WATCHING (cooldown done OR low-confidence re-arm)
 *   COOLDOWN -> EMITTING (different sign with high confidence)
 *   ANY -> IDLE (hands absent too long)
 *
 * See docs/Continuous_Sign_Recognition_Design.md for full spec.
 */

import { LandmarkBuffer } from "./landmark-buffer";
import { SoftmaxEMA } from "./ema-smoother";
import { FRAME_SIZE, NUM_SIGN_CLASSES, RecognitionConfig } from "./constants";

export type EngineState =
  | "IDLE"
  | "WATCHING"
  | "INFERRING"
  | "EMITTING"
  | "COOLDOWN";

export interface SignEmission {
  sign: string;
  confidence: number;
  classIndex: number;
  timestamp: number;
}

export interface InferenceResult {
  /** Top-k sorted by descending probability. */
  topK: Array<{ sign: string; classIndex: number; confidence: number }>;
  /** Full softmax over all classes (length NUM_SIGN_CLASSES). */
  allProbs: Float32Array;
}

export type InferenceFn = (frames: Float32Array[]) => Promise<InferenceResult>;

export interface EngineCallbacks {
  onEmit: (emission: SignEmission) => void;
  onStateChange?: (state: EngineState, prev: EngineState) => void;
  onInferenceError?: (err: unknown) => void;
}

export interface EngineDebugSnapshot {
  state: EngineState;
  bufferSize: number;
  bufferCapacity: number;
  handPresence: number;
  topK: Array<{ sign: string; classIndex: number; prob: number }>;
  stableTicks: number;
  cooldownRemainingMs: number;
  lastInferenceMs: number;
  inferenceInFlight: boolean;
  framesSincePush: number;
}

interface EmittedSignTracking {
  classIndex: number;
  emittedAt: number;
  belowRearmSinceMs: number | null;
}

export class RecognitionEngine {
  private readonly buffer: LandmarkBuffer;
  private readonly ema: SoftmaxEMA;
  private state: EngineState = "IDLE";

  private framesSinceLastInference = 0;
  private inferenceInFlight = false;

  private handsPresentSinceMs: number | null = null;
  private handsAbsentSinceMs: number | null = null;

  private currentArgmax = -1;
  private stableTicks = 0;

  private lastEmission: EmittedSignTracking | null = null;
  private cooldownStartMs = 0;

  private lastInferenceLatency = 0;
  private lastTimestamp = 0;

  private resolveSignName: (classIndex: number) => string;

  constructor(
    private readonly config: RecognitionConfig,
    private readonly inferenceFn: InferenceFn,
    private readonly callbacks: EngineCallbacks,
    resolveSignName: (classIndex: number) => string = (i) => `class_${i}`,
  ) {
    this.buffer = new LandmarkBuffer(config.bufferSize, FRAME_SIZE);
    this.ema = new SoftmaxEMA(NUM_SIGN_CLASSES, config.emaAlpha);
    this.resolveSignName = resolveSignName;
  }

  /** Called per captured frame from the camera (typically ~30Hz). */
  pushFrame(frame: Float32Array, hasHands: boolean, timestampMs: number): void {
    this.lastTimestamp = timestampMs;
    this.buffer.push(frame, hasHands);
    this.framesSinceLastInference++;

    this.updateHandPresenceTimers(hasHands, timestampMs);
    this.runStateMachine(timestampMs);

    if (this.shouldRunInference()) {
      this.framesSinceLastInference = 0;
      this.scheduleInference();
    }
  }

  reset(): void {
    this.buffer.clear();
    this.ema.reset();
    this.state = "IDLE";
    this.framesSinceLastInference = 0;
    this.handsPresentSinceMs = null;
    this.handsAbsentSinceMs = null;
    this.currentArgmax = -1;
    this.stableTicks = 0;
    this.lastEmission = null;
    this.cooldownStartMs = 0;
  }

  getDebug(): EngineDebugSnapshot {
    const topK = this.ema.topK(5).map((e) => ({
      sign: this.resolveSignName(e.index),
      classIndex: e.index,
      prob: e.prob,
    }));
    return {
      state: this.state,
      bufferSize: this.buffer.size(),
      bufferCapacity: this.buffer.capacity,
      handPresence: this.buffer.handPresenceRatio(),
      topK,
      stableTicks: this.stableTicks,
      cooldownRemainingMs:
        this.state === "COOLDOWN"
          ? Math.max(0, this.config.cooldownMs - (this.lastTimestamp - this.cooldownStartMs))
          : 0,
      lastInferenceMs: this.lastInferenceLatency,
      inferenceInFlight: this.inferenceInFlight,
      framesSincePush: this.framesSinceLastInference,
    };
  }

  getState(): EngineState {
    return this.state;
  }

  // ---------- internals ----------

  private setState(next: EngineState): void {
    if (next === this.state) return;
    const prev = this.state;
    this.state = next;
    this.callbacks.onStateChange?.(next, prev);
  }

  private updateHandPresenceTimers(hasHands: boolean, ts: number): void {
    if (hasHands) {
      this.handsAbsentSinceMs = null;
      if (this.handsPresentSinceMs === null) this.handsPresentSinceMs = ts;
    } else {
      this.handsPresentSinceMs = null;
      if (this.handsAbsentSinceMs === null) this.handsAbsentSinceMs = ts;
    }
  }

  private runStateMachine(ts: number): void {
    // Universal transition: hands gone too long -> IDLE
    if (
      this.state !== "IDLE" &&
      this.handsAbsentSinceMs !== null &&
      ts - this.handsAbsentSinceMs >= this.config.idleHandsGoneMs
    ) {
      this.toIdle();
      return;
    }

    switch (this.state) {
      case "IDLE":
        if (
          this.handsPresentSinceMs !== null &&
          ts - this.handsPresentSinceMs >= this.config.watchingHandsPresentMs
        ) {
          this.buffer.clear();
          this.ema.reset();
          this.currentArgmax = -1;
          this.stableTicks = 0;
          this.setState("WATCHING");
        }
        break;

      case "WATCHING":
        if (
          this.buffer.isFull() &&
          this.buffer.handPresenceRatio() >= this.config.handPresenceRatio
        ) {
          this.setState("INFERRING");
        }
        break;

      case "INFERRING":
        // Stay; transition happens via processInferenceResult.
        break;

      case "EMITTING":
        // Immediate transition to COOLDOWN
        this.cooldownStartMs = ts;
        this.setState("COOLDOWN");
        break;

      case "COOLDOWN":
        // Do NOT auto-transition on timer alone - the buffer still contains
        // the just-emitted sign and would immediately re-fire. We require
        // the explicit re-arm signal (EMA of last emitted sign drops below
        // rearm threshold) which is checked in processInferenceResult().
        // The cooldownMs is a minimum quiet period before re-arm logic runs.
        break;
    }
  }

  private toIdle(): void {
    this.setState("IDLE");
    this.buffer.clear();
    this.ema.reset();
    this.currentArgmax = -1;
    this.stableTicks = 0;
    this.lastEmission = null;
  }

  private shouldRunInference(): boolean {
    if (this.inferenceInFlight) return false;
    if (this.state !== "INFERRING" && this.state !== "COOLDOWN") return false;
    if (!this.buffer.isFull()) return false;
    if (this.buffer.handPresenceRatio() < this.config.handPresenceRatio) return false;
    return this.framesSinceLastInference >= this.config.inferenceIntervalFrames;
  }

  private scheduleInference(): void {
    this.inferenceInFlight = true;
    const startTs = performance.now();
    const frames = this.buffer.toArray();
    this.inferenceFn(frames)
      .then((result) => {
        this.lastInferenceLatency = performance.now() - startTs;
        this.processInferenceResult(result, this.lastTimestamp);
      })
      .catch((err) => {
        this.callbacks.onInferenceError?.(err);
      })
      .finally(() => {
        this.inferenceInFlight = false;
      });
  }

  private processInferenceResult(result: InferenceResult, ts: number): void {
    this.ema.update(result.allProbs);
    const top = this.ema.argmax();

    if (top.index === this.currentArgmax) {
      this.stableTicks++;
    } else {
      this.currentArgmax = top.index;
      this.stableTicks = 1;
    }

    if (this.state === "INFERRING") {
      if (
        top.prob >= this.config.confidenceThreshold &&
        this.stableTicks >= this.config.stabilityTicks
      ) {
        this.emit(top.index, top.prob, ts);
      }
      return;
    }

    if (this.state === "COOLDOWN" && this.lastEmission) {
      const cooldownElapsed = ts - this.cooldownStartMs >= this.config.cooldownMs;
      const sameSign = top.index === this.lastEmission.classIndex;

      // Different sign with very high confidence -> early break (always allowed)
      if (!sameSign && top.prob >= this.config.earlyBreakConfidence) {
        this.emit(top.index, top.prob, ts);
        return;
      }

      // Re-arm: requires cooldown timer to have expired AND EMA of last
      // emitted sign to drop below rearm threshold for required duration.
      if (cooldownElapsed) {
        const lastSignProb = this.ema.probOf(this.lastEmission.classIndex);
        if (lastSignProb < this.config.rearmLowConfidence) {
          if (this.lastEmission.belowRearmSinceMs === null) {
            this.lastEmission.belowRearmSinceMs = ts;
          } else if (
            ts - this.lastEmission.belowRearmSinceMs >=
            this.config.rearmLowConfidenceMs
          ) {
            this.setState("WATCHING");
          }
        } else {
          this.lastEmission.belowRearmSinceMs = null;
        }
      }
    }
  }

  private emit(classIndex: number, confidence: number, ts: number): void {
    const sign = this.resolveSignName(classIndex);
    const emission: SignEmission = { sign, confidence, classIndex, timestamp: ts };
    this.lastEmission = {
      classIndex,
      emittedAt: ts,
      belowRearmSinceMs: null,
    };
    this.cooldownStartMs = ts;
    this.callbacks.onEmit(emission);
    this.setState("COOLDOWN");
    // Reset stability so the same sign must re-stabilize after cooldown
    this.stableTicks = 0;
  }
}
