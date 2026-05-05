"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_CONFIG,
  RecognitionConfig,
} from "@/app/lib/sign-recognition/constants";
import {
  extractLandmarks,
  hasHands,
  MediaPipeResults,
} from "@/app/lib/sign-recognition/landmark-extractor";
import {
  EngineDebugSnapshot,
  EngineState,
  RecognitionEngine,
  SignEmission,
} from "@/app/lib/sign-recognition/recognition-engine";
import {
  fetchLabelMap,
  recognizeSign,
} from "@/app/lib/sign-recognition/backend-client";

export type RecognitionMode = "continuous" | "manual";

export interface UseSignRecognitionOptions {
  enabled: boolean;
  mode: RecognitionMode;
  config?: Partial<RecognitionConfig>;
  onEmit: (emission: SignEmission) => void;
  apiUrl?: string;
}

export interface UseSignRecognitionResult {
  state: EngineState;
  debug: EngineDebugSnapshot | null;
  labelsReady: boolean;
  pushFrame: (results: MediaPipeResults) => void;
  recordManual: () => Promise<SignEmission | null>;
  reset: () => void;
}

/**
 * Hook that wires MediaPipe results into the RecognitionEngine.
 * Manages label map fetching, engine lifecycle, and exposes manual capture.
 */
export function useSignRecognition(
  opts: UseSignRecognitionOptions,
): UseSignRecognitionResult {
  const config = useMemo<RecognitionConfig>(
    () => ({ ...DEFAULT_CONFIG, ...opts.config }),
    [opts.config],
  );

  const labelMapRef = useRef<Map<number, string> | null>(null);
  const [labelsReady, setLabelsReady] = useState(false);
  const [state, setState] = useState<EngineState>("IDLE");
  const [debug, setDebug] = useState<EngineDebugSnapshot | null>(null);

  const engineRef = useRef<RecognitionEngine | null>(null);
  const onEmitRef = useRef(opts.onEmit);
  useEffect(() => { onEmitRef.current = opts.onEmit; }, [opts.onEmit]);

  // Manual mode collection
  const manualBufferRef = useRef<Float32Array[]>([]);
  const manualCollectingRef = useRef(false);

  // Fetch label map once
  useEffect(() => {
    let cancelled = false;
    fetchLabelMap(opts.apiUrl)
      .then((map) => {
        if (!cancelled) {
          labelMapRef.current = map;
          setLabelsReady(true);
        }
      })
      .catch((err) => console.error("[S2S] label fetch failed:", err));
    return () => { cancelled = true; };
  }, [opts.apiUrl]);

  // Build engine when labels ready
  useEffect(() => {
    if (!labelsReady || !labelMapRef.current) return;
    const labelMap = labelMapRef.current;

    const inferenceFn = async (frames: Float32Array[]) => {
      return recognizeSign(frames, labelMap, { apiUrl: opts.apiUrl });
    };

    engineRef.current = new RecognitionEngine(
      config,
      inferenceFn,
      {
        onEmit: (e) => {
          console.log(`[S2S] EMIT: ${e.sign} (${(e.confidence * 100).toFixed(1)}%)`);
          onEmitRef.current(e);
        },
        onStateChange: (next, prev) => {
          console.log(`[S2S] state: ${prev} -> ${next}`);
          setState(next);
        },
        onInferenceError: (err) => {
          console.error("[S2S] inference error:", err);
        },
      },
      (idx) => labelMap.get(idx) ?? `class_${idx}`,
    );

    return () => {
      engineRef.current?.reset();
      engineRef.current = null;
    };
  }, [labelsReady, config, opts.apiUrl]);

  // Periodic debug snapshot (3Hz)
  useEffect(() => {
    if (!opts.enabled || !engineRef.current) return;
    const id = setInterval(() => {
      if (engineRef.current) setDebug(engineRef.current.getDebug());
    }, 333);
    return () => clearInterval(id);
  }, [opts.enabled, labelsReady]);

  const pushFrame = useCallback((results: MediaPipeResults) => {
    if (!opts.enabled) return;
    const frame = extractLandmarks(results);
    const visible = hasHands(results);
    const ts = performance.now();

    if (opts.mode === "continuous") {
      engineRef.current?.pushFrame(frame, visible, ts);
    }
    if (manualCollectingRef.current) {
      manualBufferRef.current.push(frame.slice());
    }
  }, [opts.enabled, opts.mode]);

  const recordManual = useCallback(async (): Promise<SignEmission | null> => {
    if (!labelMapRef.current) {
      console.warn("[S2S] labels not ready");
      return null;
    }
    manualBufferRef.current = [];
    manualCollectingRef.current = true;
    await new Promise((r) => setTimeout(r, config.manualCaptureMs));
    manualCollectingRef.current = false;

    const frames = manualBufferRef.current;
    manualBufferRef.current = [];
    if (frames.length < 5) {
      console.warn("[S2S] manual: too few frames", frames.length);
      return null;
    }

    try {
      const result = await recognizeSign(frames, labelMapRef.current, {
        apiUrl: opts.apiUrl,
      });
      const top = result.topK[0];
      if (!top) return null;
      const emission: SignEmission = {
        sign: top.sign,
        confidence: top.confidence,
        classIndex: top.classIndex,
        timestamp: performance.now(),
      };
      onEmitRef.current(emission);
      return emission;
    } catch (err) {
      console.error("[S2S] manual recognition failed:", err);
      return null;
    }
  }, [config.manualCaptureMs, opts.apiUrl]);

  const reset = useCallback(() => {
    engineRef.current?.reset();
    manualBufferRef.current = [];
    manualCollectingRef.current = false;
    setState("IDLE");
  }, []);

  return { state, debug, labelsReady, pushFrame, recordManual, reset };
}
