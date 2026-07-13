/**
 * WAV (16 kHz mono PCM16) encoding for captured audio.
 *
 * Pure, stateless helpers shared by any audio capture path. The backend
 * `/audio-to-text` endpoint reads the multipart WAV with libsndfile, so the
 * output must be a real PCM WAV, not a compressed container.
 */

export const TARGET_SAMPLE_RATE = 16000;

export function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

/** Linear resample of a full mono buffer from inputRate to outputRate. */
export function resampleLinear(
  input: Float32Array,
  inputRate: number,
  outputRate: number,
): Float32Array {
  if (inputRate === outputRate) return input;
  const ratio = outputRate / inputRate;
  const outLen = Math.max(1, Math.round(input.length * ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i / ratio;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const s0 = input[idx] ?? 0;
    const s1 = input[idx + 1] ?? s0;
    out[i] = s0 + (s1 - s0) * frac;
  }
  return out;
}

export function encodeWav(pcm16: Int16Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + pcm16.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + pcm16.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, "data");
  view.setUint32(40, pcm16.length * 2, true);

  let offset = 44;
  for (let i = 0; i < pcm16.length; i++, offset += 2) {
    view.setInt16(offset, pcm16[i], true);
  }

  return new Blob([view], { type: "audio/wav" });
}

/** Encode a mono Float32 buffer (at inputRate) as a 16 kHz mono WAV Blob. */
export function encodeWavFromFloat32(
  mono: Float32Array,
  inputRate: number,
): Blob {
  const resampled = resampleLinear(mono, inputRate, TARGET_SAMPLE_RATE);
  const pcm16 = floatTo16BitPCM(resampled);
  return encodeWav(pcm16, TARGET_SAMPLE_RATE);
}
