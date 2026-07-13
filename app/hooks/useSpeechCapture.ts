"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { encodeWavFromFloat32 } from "@/app/lib/audio/wav-encoder";

export interface SpeechCaptureResult {
  wav: Blob;
  durationSec: number;
}

export interface UseSpeechCapture {
  /** ~18-band spectrum 0..1, live while the mic is monitoring. */
  bands: number[];
  /** Single 0..1 input level, for a prominent meter. */
  level: number;
  /** Mic is open and monitoring. */
  isActive: boolean;
  error: string | null;
  /** Open the mic and start live monitoring (bands/level animate). */
  start: () => Promise<void>;
  /** Close the mic entirely. */
  stop: () => void;
  /** Begin a fresh recording window (mic keeps monitoring). */
  beginRecording: () => void;
  /** End the recording window, return audio as 16 kHz mono WAV. */
  finishRecording: () => SpeechCaptureResult | null;
}

const NUM_BANDS = 18;

const WORKLET_CODE = `
class CaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor('speech-capture', CaptureProcessor);
`;

export function useSpeechCapture(): UseSpeechCapture {
  const [bands, setBands] = useState<number[]>(() => new Array(NUM_BANDS).fill(0));
  const [level, setLevel] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const nodeRef = useRef<AudioWorkletNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);

  const chunksRef = useRef<Float32Array[]>([]);
  const recordingRef = useRef(false);
  const inputRateRef = useRef<number>(48000);

  const teardown = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    recordingRef.current = false;
    if (nodeRef.current) nodeRef.current.port.onmessage = null;
    nodeRef.current?.disconnect();
    gainRef.current?.disconnect();
    analyserRef.current?.disconnect();
    sourceRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    ctxRef.current?.close().catch(() => {});
    nodeRef.current = null;
    gainRef.current = null;
    analyserRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;
    ctxRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (ctxRef.current) return; // already monitoring
    setError(null);
    chunksRef.current = [];
    recordingRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      ctxRef.current = ctx;
      inputRateRef.current = ctx.sampleRate;

      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.7;
      source.connect(analyser);
      analyserRef.current = analyser;

      const blob = new Blob([WORKLET_CODE], { type: "application/javascript" });
      const url = URL.createObjectURL(blob);
      await ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);

      const node = new AudioWorkletNode(ctx, "speech-capture");
      node.port.onmessage = (ev: MessageEvent<Float32Array>) => {
        if (recordingRef.current && ev.data) chunksRef.current.push(ev.data);
      };
      nodeRef.current = node;

      // Worklet only runs when the graph reaches the destination; route it
      // through a muted gain so it pumps frames without audible feedback.
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gainRef.current = gain;
      source.connect(node);
      node.connect(gain);
      gain.connect(ctx.destination);

      setIsActive(true);

      const bins = analyser.frequencyBinCount;
      const data = new Uint8Array(bins);
      const bandsArr = new Array(NUM_BANDS).fill(0);
      const step = Math.floor(bins / NUM_BANDS);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let b = 0; b < NUM_BANDS; b++) {
          let s = 0;
          for (let i = b * step; i < (b + 1) * step; i++) s += data[i];
          bandsArr[b] = s / step / 255;
          sum += bandsArr[b];
        }
        setBands([...bandsArr]);
        setLevel(sum / NUM_BANDS);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (err: any) {
      setError(err?.message || "Microphone permission denied");
      setIsActive(false);
    }
  }, []);

  const stop = useCallback(() => {
    teardown();
    setIsActive(false);
    setBands(new Array(NUM_BANDS).fill(0));
    setLevel(0);
  }, [teardown]);

  const beginRecording = useCallback(() => {
    chunksRef.current = [];
    recordingRef.current = true;
  }, []);

  const finishRecording = useCallback((): SpeechCaptureResult | null => {
    recordingRef.current = false;
    const chunks = chunksRef.current;
    chunksRef.current = [];
    const total = chunks.reduce((a, c) => a + c.length, 0);
    if (total === 0) return null;
    const mono = new Float32Array(total);
    let off = 0;
    for (const c of chunks) {
      mono.set(c, off);
      off += c.length;
    }
    return {
      wav: encodeWavFromFloat32(mono, inputRateRef.current),
      durationSec: total / inputRateRef.current,
    };
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  return { bands, level, isActive, error, start, stop, beginRecording, finishRecording };
}
