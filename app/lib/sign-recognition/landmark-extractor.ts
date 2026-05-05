/**
 * Pure landmark extraction from MediaPipe Holistic results.
 * Output: Float32Array(543 * 3) in canonical order:
 *   face(468) + left_hand(21) + pose(33) + right_hand(21)
 *
 * Missing landmarks are NaN. The Kaggle GISLR model's internal
 * preprocessing distinguishes NaN ("not detected") from 0.0.
 */

import {
  FACE_LANDMARKS,
  FRAME_SIZE,
  LEFT_HAND_LANDMARKS,
  LEFT_HAND_START,
  POSE_LANDMARKS,
  RIGHT_HAND_LANDMARKS,
  RIGHT_HAND_START,
  TOTAL_LANDMARKS,
} from "./constants";

export interface MediaPipeLandmark {
  x: number;
  y: number;
  z: number;
}

export interface MediaPipeResults {
  faceLandmarks?: MediaPipeLandmark[];
  leftHandLandmarks?: MediaPipeLandmark[];
  poseLandmarks?: MediaPipeLandmark[];
  rightHandLandmarks?: MediaPipeLandmark[];
}

const POSE_OFFSET = (FACE_LANDMARKS + LEFT_HAND_LANDMARKS) * 3;
const LEFT_HAND_OFFSET = LEFT_HAND_START * 3;
const RIGHT_HAND_OFFSET = RIGHT_HAND_START * 3;

export function extractLandmarks(
  results: MediaPipeResults,
  out?: Float32Array,
): Float32Array {
  const frame = out ?? new Float32Array(FRAME_SIZE);
  frame.fill(NaN);

  if (results.faceLandmarks) {
    const limit = Math.min(results.faceLandmarks.length, FACE_LANDMARKS);
    for (let i = 0; i < limit; i++) {
      const lm = results.faceLandmarks[i];
      frame[i * 3] = lm.x;
      frame[i * 3 + 1] = lm.y;
      frame[i * 3 + 2] = lm.z;
    }
  }

  if (results.leftHandLandmarks) {
    const limit = Math.min(results.leftHandLandmarks.length, LEFT_HAND_LANDMARKS);
    for (let i = 0; i < limit; i++) {
      const lm = results.leftHandLandmarks[i];
      frame[LEFT_HAND_OFFSET + i * 3] = lm.x;
      frame[LEFT_HAND_OFFSET + i * 3 + 1] = lm.y;
      frame[LEFT_HAND_OFFSET + i * 3 + 2] = lm.z;
    }
  }

  if (results.poseLandmarks) {
    const limit = Math.min(results.poseLandmarks.length, POSE_LANDMARKS);
    for (let i = 0; i < limit; i++) {
      const lm = results.poseLandmarks[i];
      frame[POSE_OFFSET + i * 3] = lm.x;
      frame[POSE_OFFSET + i * 3 + 1] = lm.y;
      frame[POSE_OFFSET + i * 3 + 2] = lm.z;
    }
  }

  if (results.rightHandLandmarks) {
    const limit = Math.min(results.rightHandLandmarks.length, RIGHT_HAND_LANDMARKS);
    for (let i = 0; i < limit; i++) {
      const lm = results.rightHandLandmarks[i];
      frame[RIGHT_HAND_OFFSET + i * 3] = lm.x;
      frame[RIGHT_HAND_OFFSET + i * 3 + 1] = lm.y;
      frame[RIGHT_HAND_OFFSET + i * 3 + 2] = lm.z;
    }
  }

  return frame;
}

/** True if any hand landmark is non-NaN. */
export function hasHands(results: MediaPipeResults): boolean {
  return !!(results.leftHandLandmarks?.length || results.rightHandLandmarks?.length);
}

/** Convert flat Float32Array frame to JSON-safe nested array, NaN -> null. */
export function frameToJson(frame: Float32Array): (number | null)[][] {
  const out: (number | null)[][] = new Array(TOTAL_LANDMARKS);
  for (let i = 0; i < TOTAL_LANDMARKS; i++) {
    const x = frame[i * 3];
    const y = frame[i * 3 + 1];
    const z = frame[i * 3 + 2];
    out[i] = [
      Number.isNaN(x) ? null : x,
      Number.isNaN(y) ? null : y,
      Number.isNaN(z) ? null : z,
    ];
  }
  return out;
}
