"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Switch } from "@/app/components/ui/switch";
import { Camera, CameraOff, Loader2, Hand, Circle, Bug } from "lucide-react";
import { useMediaPipeHolistic } from "@/app/hooks/useMediaPipeHolistic";
import {
  useSignRecognition,
  RecognitionMode,
} from "@/app/hooks/useSignRecognition";
import { hasHands, MediaPipeResults } from "@/app/lib/sign-recognition/landmark-extractor";
import type { SignEmission } from "@/app/lib/sign-recognition/recognition-engine";
import { RecognitionDevOverlay } from "./RecognitionDevOverlay";

export interface SignRecognitionResult {
  sign: string;
  confidence: number;
  top_5?: Array<{ sign: string; confidence: number }>;
}

interface WebcamCaptureProps {
  onSignRecognized?: (result: SignRecognitionResult) => void;
  onStatusChange?: (status: string) => void;
}

const STATE_LABEL: Record<string, string> = {
  IDLE: "Idle",
  WATCHING: "Watching",
  INFERRING: "Listening",
  EMITTING: "Recognized",
  COOLDOWN: "Cooldown",
};

const STATE_BADGE: Record<string, string> = {
  IDLE: "bg-gray-100 text-gray-600",
  WATCHING: "bg-blue-100 text-blue-700",
  INFERRING: "bg-purple-100 text-purple-700",
  EMITTING: "bg-green-100 text-green-700",
  COOLDOWN: "bg-amber-100 text-amber-700",
};

export function WebcamCapture({ onSignRecognized, onStatusChange }: WebcamCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastResultsRef = useRef<MediaPipeResults | null>(null);

  const [mode, setMode] = useState<RecognitionMode>("continuous");
  const [showDebug, setShowDebug] = useState(false);
  const [handsVisible, setHandsVisible] = useState(false);
  const [recognitionCount, setRecognitionCount] = useState(0);
  const [manualBusy, setManualBusy] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Bridge: MediaPipe results -> recognition + canvas drawing
  const handleResults = useCallback((results: MediaPipeResults) => {
    lastResultsRef.current = results;
    setHandsVisible(hasHands(results));

    // Draw landmarks
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (canvas && video && video.videoWidth > 0) {
      if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
      if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
      mp.drawHands(canvas, results);
    }

    // Push to engine
    rec.pushFrame(results);
  }, []);

  const mp = useMediaPipeHolistic(handleResults);

  const onEmit = useCallback((e: SignEmission) => {
    setRecognitionCount((c) => c + 1);
    onSignRecognized?.({
      sign: e.sign,
      confidence: e.confidence,
    });
  }, [onSignRecognized]);

  const rec = useSignRecognition({
    enabled: mp.isActive,
    mode,
    onEmit,
  });

  // Surface combined status to parent
  useEffect(() => {
    if (!mp.isActive) {
      onStatusChange?.("idle");
    } else {
      onStatusChange?.(rec.state.toLowerCase());
    }
  }, [mp.isActive, rec.state, onStatusChange]);

  const startCamera = useCallback(async () => {
    if (videoRef.current) await mp.start(videoRef.current);
  }, [mp]);

  const stopCamera = useCallback(() => {
    mp.stop();
    rec.reset();
  }, [mp, rec]);

  const recordManual = useCallback(async () => {
    if (manualBusy) return;
    setManualBusy(true);
    try {
      // 1s countdown
      setCountdown(1);
      await new Promise((r) => setTimeout(r, 1000));
      setCountdown(0);
      await rec.recordManual();
    } finally {
      setManualBusy(false);
    }
  }, [manualBusy, rec]);

  const displayState = mp.isActive ? rec.state : "IDLE";

  return (
    <Card className="w-full bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <div className="bg-orange-100 p-1.5 rounded">
              <Hand className="h-4 w-4 text-orange-600" />
            </div>
            <span className="text-orange-900">Sign Capture</span>
          </div>
          <Badge className={`text-xs ${STATE_BADGE[displayState] ?? "bg-gray-100 text-gray-600"}`}>
            {STATE_LABEL[displayState] ?? "Inactive"}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Mode toggle */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Switch
              checked={mode === "continuous"}
              onCheckedChange={(v) => setMode(v ? "continuous" : "manual")}
              disabled={mp.isActive && rec.state !== "IDLE"}
            />
            <span className="text-gray-700">
              {mode === "continuous" ? "Continuous mode" : "Manual mode"}
            </span>
          </div>
          <button
            onClick={() => setShowDebug((v) => !v)}
            className="flex items-center gap-1 text-gray-500 hover:text-gray-800"
          >
            <Bug className="h-3 w-3" />
            {showDebug ? "Hide debug" : "Show debug"}
          </button>
        </div>

        {/* Webcam */}
        <div className="relative bg-black rounded overflow-hidden aspect-[4/3]">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
            muted
            style={{ transform: "scaleX(-1)" }}
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ transform: "scaleX(-1)" }}
          />

          {!mp.isActive && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
              <p className="text-gray-400 text-sm">Camera not active</p>
            </div>
          )}

          {mp.isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
              <div className="flex items-center gap-2 text-white">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading MediaPipe...</span>
              </div>
            </div>
          )}

          {countdown > 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <div className="text-7xl font-bold text-white drop-shadow-lg">{countdown}</div>
            </div>
          )}

          {manualBusy && countdown === 0 && (
            <>
              <div className="absolute top-2 left-2">
                <Badge className="bg-red-500 text-white text-xs">REC</Badge>
              </div>
            </>
          )}

          {mp.isActive && (
            <div className="absolute top-2 right-2">
              <Badge className={`text-xs ${handsVisible ? "bg-green-500" : "bg-gray-500"} text-white`}>
                {handsVisible ? "Hands detected" : "Show hands"}
              </Badge>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-2">
          <Button
            onClick={mp.isActive ? stopCamera : startCamera}
            variant="outline"
            size="sm"
            disabled={mp.isLoading || !rec.labelsReady}
          >
            {mp.isLoading || !rec.labelsReady ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : mp.isActive ? (
              <CameraOff className="h-4 w-4 mr-1" />
            ) : (
              <Camera className="h-4 w-4 mr-1" />
            )}
            {mp.isActive ? "Stop" : "Start Camera"}
          </Button>

          {mode === "manual" && (
            <Button
              onClick={recordManual}
              disabled={!mp.isActive || manualBusy}
              size="sm"
              className="bg-orange-600 hover:bg-orange-700 flex-1"
            >
              <Circle className="h-4 w-4 mr-1 fill-current" />
              Record Sign
            </Button>
          )}

          {mode === "continuous" && mp.isActive && (
            <div className="text-xs text-gray-600 flex-1 text-center">
              Sign naturally - signs auto-detected
            </div>
          )}
        </div>

        <div className="text-xs text-gray-600 text-center">
          {!mp.isActive && rec.labelsReady && "Click Start Camera to begin"}
          {!rec.labelsReady && "Loading sign vocabulary..."}
          {recognitionCount > 0 && (
            <span className="text-orange-700">
              {" "}{recognitionCount} sign{recognitionCount !== 1 ? "s" : ""} recognized
            </span>
          )}
        </div>

        {mp.error && (
          <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700">
            {mp.error}
          </div>
        )}

        <RecognitionDevOverlay debug={rec.debug} visible={showDebug} />
      </CardContent>
    </Card>
  );
}
