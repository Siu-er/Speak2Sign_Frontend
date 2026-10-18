"use client";

import { useEffect, useState } from "react";

// Speech RMS rarely exceeds this on a laptop microphone; scaling by it maps a
// normal speaking voice to the upper half of the 0..1 range.
const SPEECH_RMS_CEILING = 0.18;
const SMOOTHING = 0.25;

/**
 * Live microphone loudness in 0..1 while `active`, for voice-reactive visuals.
 * Opens its own audio stream next to speech recognition and releases it when
 * inactive.
 */
export function useMicLevel(active: boolean): { level: number; error: string } {
  const [level, setLevel] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!active) { setLevel(0); return; }
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let raf = 0;
    let cancelled = false;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) return;
        ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const buf = new Float32Array(analyser.fftSize);
        let smooth = 0;
        const tick = () => {
          analyser.getFloatTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
          const rms = Math.sqrt(sum / buf.length);
          smooth += (Math.min(1, rms / SPEECH_RMS_CEILING) - smooth) * SMOOTHING;
          setLevel(smooth);
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      ctx?.close();
    };
  }, [active]);

  return { level, error };
}
