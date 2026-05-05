/**
 * Exponential moving average over softmax probability vectors.
 *   p_smooth = alpha * p_new + (1 - alpha) * p_smooth
 *
 * Used to smooth class probabilities across consecutive inference ticks,
 * reducing jitter from transient predictions during sign transitions.
 */

export class SoftmaxEMA {
  private smoothed: Float32Array | null = null;

  constructor(
    public readonly numClasses: number,
    public readonly alpha: number,
  ) {
    if (alpha <= 0 || alpha > 1) {
      throw new Error(`EMA alpha must be in (0, 1], got ${alpha}`);
    }
  }

  update(probs: ArrayLike<number>): void {
    if (probs.length !== this.numClasses) {
      throw new Error(
        `probs length mismatch: expected ${this.numClasses}, got ${probs.length}`,
      );
    }
    if (!this.smoothed) {
      this.smoothed = new Float32Array(this.numClasses);
      for (let i = 0; i < this.numClasses; i++) {
        this.smoothed[i] = probs[i];
      }
      return;
    }
    const a = this.alpha;
    const oneMinusA = 1 - a;
    for (let i = 0; i < this.numClasses; i++) {
      this.smoothed[i] = a * probs[i] + oneMinusA * this.smoothed[i];
    }
  }

  argmax(): { index: number; prob: number } {
    if (!this.smoothed) return { index: -1, prob: 0 };
    let maxIdx = 0;
    let maxVal = this.smoothed[0];
    for (let i = 1; i < this.numClasses; i++) {
      if (this.smoothed[i] > maxVal) {
        maxVal = this.smoothed[i];
        maxIdx = i;
      }
    }
    return { index: maxIdx, prob: maxVal };
  }

  topK(k: number): Array<{ index: number; prob: number }> {
    if (!this.smoothed) return [];
    const arr = Array.from(this.smoothed).map((prob, index) => ({ index, prob }));
    arr.sort((a, b) => b.prob - a.prob);
    return arr.slice(0, k);
  }

  /** Probability of a specific class (or 0 if not initialized). */
  probOf(index: number): number {
    if (!this.smoothed) return 0;
    return this.smoothed[index];
  }

  reset(): void {
    this.smoothed = null;
  }

  isInitialized(): boolean {
    return this.smoothed !== null;
  }
}
