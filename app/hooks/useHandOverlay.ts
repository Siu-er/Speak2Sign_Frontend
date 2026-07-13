"use client";

import { useEffect, useRef } from "react";
import type { HandLandmarker, NormalizedLandmark } from "@mediapipe/tasks-vision";

// MediaPipe hand topology (21 landmarks).
const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

function drawHand(ctx: CanvasRenderingContext2D, hand: NormalizedLandmark[], w: number, h: number) {
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(37, 99, 235, 0.9)";
  for (const [a, b] of HAND_CONNECTIONS) {
    ctx.beginPath();
    ctx.moveTo(hand[a].x * w, hand[a].y * h);
    ctx.lineTo(hand[b].x * w, hand[b].y * h);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  for (const p of hand) {
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * When enabled, runs the MediaPipe HandLandmarker on the camera video and draws
 * a hand skeleton onto the overlay canvas. Purely a visual aid for the signer;
 * recognition is unaffected (it runs server-side on the recorded clip). The
 * model is heavy, so this stays off unless the user opts in.
 */
export function useHandOverlay(
  videoRef: React.RefObject<HTMLVideoElement>,
  canvasRef: React.RefObject<HTMLCanvasElement>,
  enabled: boolean,
) {
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let landmarker: HandLandmarker | null = null;

    const loop = () => {
      if (cancelled) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && landmarker && video.readyState >= 2) {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (w && h) {
          if (canvas.width !== w) canvas.width = w;
          if (canvas.height !== h) canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, w, h);
            const res = landmarker.detectForVideo(video, performance.now());
            for (const hand of res.landmarks) drawHand(ctx, hand, w, h);
          }
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    (async () => {
      const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
      const created = await HandLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: "/mediapipe/hand_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
      });
      if (cancelled) {
        created.close();
        return;
      }
      landmarker = created;
      loop();
    })().catch((e) => {
      console.error("Hand overlay failed to start:", e);
    });

    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      landmarker?.close();
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [enabled, videoRef, canvasRef]);
}
