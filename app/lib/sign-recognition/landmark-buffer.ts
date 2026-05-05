/**
 * Pre-allocated ring buffer for landmark frames.
 * Single Float32Array; no per-frame allocation.
 */

import {
  LEFT_HAND_END,
  LEFT_HAND_START,
  RIGHT_HAND_END,
  RIGHT_HAND_START,
} from "./constants";

export class LandmarkBuffer {
  private readonly data: Float32Array;
  private readonly handPresenceFlags: Uint8Array;
  private writeIdx = 0;
  private filled = false;

  constructor(
    public readonly capacity: number,
    public readonly frameSize: number,
  ) {
    this.data = new Float32Array(capacity * frameSize);
    this.handPresenceFlags = new Uint8Array(capacity);
  }

  push(frame: Float32Array, hasHands: boolean): void {
    if (frame.length !== this.frameSize) {
      throw new Error(
        `frame size mismatch: expected ${this.frameSize}, got ${frame.length}`,
      );
    }
    const offset = this.writeIdx * this.frameSize;
    this.data.set(frame, offset);
    this.handPresenceFlags[this.writeIdx] = hasHands ? 1 : 0;
    this.writeIdx = (this.writeIdx + 1) % this.capacity;
    if (this.writeIdx === 0) this.filled = true;
  }

  size(): number {
    return this.filled ? this.capacity : this.writeIdx;
  }

  isFull(): boolean {
    return this.filled;
  }

  clear(): void {
    this.writeIdx = 0;
    this.filled = false;
    this.handPresenceFlags.fill(0);
  }

  /** Returns frames in temporal order (oldest first) as separate Float32Arrays. */
  toArray(): Float32Array[] {
    const count = this.size();
    const out: Float32Array[] = new Array(count);
    const startIdx = this.filled ? this.writeIdx : 0;
    for (let i = 0; i < count; i++) {
      const idx = (startIdx + i) % this.capacity;
      const offset = idx * this.frameSize;
      // Copy slice so caller can safely mutate without corrupting buffer
      out[i] = this.data.slice(offset, offset + this.frameSize);
    }
    return out;
  }

  /** Fraction of currently buffered frames where at least one hand was detected. */
  handPresenceRatio(): number {
    const count = this.size();
    if (count === 0) return 0;
    let hands = 0;
    const startIdx = this.filled ? this.writeIdx : 0;
    for (let i = 0; i < count; i++) {
      const idx = (startIdx + i) % this.capacity;
      if (this.handPresenceFlags[idx]) hands++;
    }
    return hands / count;
  }
}
