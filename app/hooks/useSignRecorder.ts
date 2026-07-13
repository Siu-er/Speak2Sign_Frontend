"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SignSequence, videoToSigns } from "@/app/lib/pipeline/backend";

const MIME =
  [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ].find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) || "";

export interface UseSignRecorder {
  videoRef: React.RefObject<HTMLVideoElement>;
  cameraReady: boolean;
  recording: boolean;
  processing: boolean;
  error: string;
  start: () => void;
  stop: () => void;
  beginRecording: () => void;
  finishRecording: () => Promise<SignSequence | null>;
}

/**
 * Hold-to-record sign capture: opens the camera for preview, records one clip
 * holding a whole phrase while the user holds, and on release sends it to the
 * backend, which extracts landmarks with the training-matched Holistic pipeline
 * and slides the recognizer across the clip to return the ordered signs.
 */
export function useSignRecorder(): UseSignRecorder {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [cameraReady, setCameraReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const start = useCallback(async () => {
    if (streamRef.current) return;
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try { await videoRef.current.play(); } catch { /* autoplay */ }
      }
      setCameraReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Camera unavailable");
    }
  }, []);

  const stop = useCallback(() => {
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraReady(false);
    setRecording(false);
  }, []);

  const beginRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || recording) return;
    setError("");
    chunksRef.current = [];
    const rec = MIME ? new MediaRecorder(stream, { mimeType: MIME }) : new MediaRecorder(stream);
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorderRef.current = rec;
    rec.start();
    setRecording(true);
  }, [recording]);

  const finishRecording = useCallback((): Promise<SignSequence | null> => {
    return new Promise((resolve) => {
      const rec = recorderRef.current;
      if (!rec || rec.state === "inactive") {
        setRecording(false);
        resolve(null);
        return;
      }
      rec.onstop = async () => {
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "video/webm" });
        chunksRef.current = [];
        if (blob.size < 2000) {
          resolve(null); // too short to hold a sign
          return;
        }
        setProcessing(true);
        try {
          resolve(await videoToSigns(blob));
        } catch (e) {
          setError(e instanceof Error ? e.message : "Recognition failed");
          resolve(null);
        } finally {
          setProcessing(false);
        }
      };
      rec.stop();
    });
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { videoRef, cameraReady, recording, processing, error, start, stop, beginRecording, finishRecording };
}
