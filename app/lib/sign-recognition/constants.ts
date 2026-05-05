/**
 * Tunable parameters for the continuous sign recognition pipeline.
 * Values from research: EMNLP 2024 "Towards Online CSLR" + practitioner patterns.
 * See docs/Continuous_Sign_Recognition_Design.md
 */

export const FACE_LANDMARKS = 468;
export const LEFT_HAND_LANDMARKS = 21;
export const POSE_LANDMARKS = 33;
export const RIGHT_HAND_LANDMARKS = 21;
export const TOTAL_LANDMARKS =
  FACE_LANDMARKS + LEFT_HAND_LANDMARKS + POSE_LANDMARKS + RIGHT_HAND_LANDMARKS;
export const COORDS_PER_LANDMARK = 3;
export const FRAME_SIZE = TOTAL_LANDMARKS * COORDS_PER_LANDMARK;

export const LEFT_HAND_START = FACE_LANDMARKS;
export const LEFT_HAND_END = FACE_LANDMARKS + LEFT_HAND_LANDMARKS;
export const RIGHT_HAND_START = FACE_LANDMARKS + LEFT_HAND_LANDMARKS + POSE_LANDMARKS;
export const RIGHT_HAND_END = TOTAL_LANDMARKS;

export const NUM_SIGN_CLASSES = 250;

export interface RecognitionConfig {
  bufferSize: number;
  inferenceIntervalFrames: number;
  emaAlpha: number;
  confidenceThreshold: number;
  stabilityTicks: number;
  earlyBreakConfidence: number;
  handPresenceRatio: number;
  idleHandsGoneMs: number;
  watchingHandsPresentMs: number;
  cooldownMs: number;
  rearmLowConfidence: number;
  rearmLowConfidenceMs: number;
  manualCountdownMs: number;
  manualCaptureMs: number;
}

export const DEFAULT_CONFIG: RecognitionConfig = {
  bufferSize: 48,
  inferenceIntervalFrames: 5,
  emaAlpha: 0.4,
  confidenceThreshold: 0.5,
  stabilityTicks: 3,
  earlyBreakConfidence: 0.85,
  handPresenceRatio: 0.5,
  idleHandsGoneMs: 500,
  watchingHandsPresentMs: 200,
  cooldownMs: 500,
  rearmLowConfidence: 0.3,
  rearmLowConfidenceMs: 150,
  manualCountdownMs: 1000,
  manualCaptureMs: 2000,
};
