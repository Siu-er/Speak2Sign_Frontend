"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MediaPipeResults } from "@/app/lib/sign-recognition/landmark-extractor";

const CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/holistic";

export interface MediaPipeHandles {
  isLoading: boolean;
  isActive: boolean;
  error: string | null;
  start: (video: HTMLVideoElement) => Promise<void>;
  stop: () => void;
  drawHands: (canvas: HTMLCanvasElement, results: MediaPipeResults) => void;
}

export function useMediaPipeHolistic(
  onResults: (results: MediaPipeResults) => void,
): MediaPipeHandles {
  const onResultsRef = useRef(onResults);
  useEffect(() => { onResultsRef.current = onResults; }, [onResults]);

  const holisticRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const drawingRef = useRef<any>(null);
  const constsRef = useRef<any>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async (video: HTMLVideoElement) => {
    setError(null);
    setIsLoading(true);

    try {
      if (!holisticRef.current) {
        if (typeof window !== "undefined") (window as any).Module = undefined;

        const [holisticMod, cameraMod, drawingMod] = await Promise.all([
          import("@mediapipe/holistic"),
          import("@mediapipe/camera_utils"),
          import("@mediapipe/drawing_utils"),
        ]);

        drawingRef.current = drawingMod;
        constsRef.current = holisticMod;

        const holistic = new holisticMod.Holistic({
          locateFile: (file: string) => `${CDN}/${file}`,
        });
        holistic.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          smoothSegmentation: false,
          refineFaceLandmarks: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        holistic.onResults((res: any) => onResultsRef.current(res));
        holisticRef.current = holistic;
      }

      const cameraMod = await import("@mediapipe/camera_utils");
      const camera = new cameraMod.Camera(video, {
        onFrame: async () => {
          if (holisticRef.current && video.readyState >= 2) {
            await holisticRef.current.send({ image: video });
          }
        },
        width: 640,
        height: 480,
      });
      await camera.start();
      cameraRef.current = camera;
      setIsActive(true);
    } catch (err: any) {
      console.error("[MP] start failed:", err);
      setError(err?.message || "Failed to start camera");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const stop = useCallback(() => {
    if (cameraRef.current) {
      cameraRef.current.stop();
      cameraRef.current = null;
    }
    setIsActive(false);
  }, []);

  const drawHands = useCallback((canvas: HTMLCanvasElement, results: MediaPipeResults) => {
    const du = drawingRef.current;
    const hc = constsRef.current;
    if (!du || !hc) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (results.leftHandLandmarks) {
      du.drawConnectors(ctx, results.leftHandLandmarks, hc.HAND_CONNECTIONS, {
        color: "#22c55e", lineWidth: 2,
      });
      du.drawLandmarks(ctx, results.leftHandLandmarks, {
        color: "#16a34a", lineWidth: 1, radius: 3,
      });
    }
    if (results.rightHandLandmarks) {
      du.drawConnectors(ctx, results.rightHandLandmarks, hc.HAND_CONNECTIONS, {
        color: "#3b82f6", lineWidth: 2,
      });
      du.drawLandmarks(ctx, results.rightHandLandmarks, {
        color: "#2563eb", lineWidth: 1, radius: 3,
      });
    }
  }, []);

  useEffect(() => {
    return () => {
      cameraRef.current?.stop();
      holisticRef.current?.close?.();
    };
  }, []);

  return { isLoading, isActive, error, start, stop, drawHands };
}
