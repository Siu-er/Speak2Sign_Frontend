"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Video, Loader2, Hand } from "lucide-react";
import { SiGMLDisplay } from "@/app/components/SiGMLDisplay";
import { HoldButton } from "@/app/components/conversation/HoldButton";
import { useRoom } from "@/app/hooks/useRoom";
import { useSettings } from "@/app/hooks/useSettings";
import { useConversationLog } from "@/app/hooks/useConversationLog";
import { useSignRecorder } from "@/app/hooks/useSignRecorder";
import { useHandOverlay } from "@/app/hooks/useHandOverlay";
import { glossToSigml, textToGloss } from "@/app/lib/pipeline/backend";

interface SentenceSegment {
  transcription: string;
  gloss: string;
  sigml: string;
  fingerspelled: string[];
}

/** Signer device: holds to record one sign at a time, receives speech as avatar. */
export function SignerConversation() {
  const room = useRoom();
  const { settings, update } = useSettings();
  const { record } = useConversationLog();
  const recorder = useSignRecorder();
  const overlayRef = useRef<HTMLCanvasElement>(null);
  useHandOverlay(recorder.videoRef, overlayRef, settings.showLandmarks);

  const [lastResult, setLastResult] = useState<string | null>(null);

  const startCam = recorder.start;
  const stopCam = recorder.stop;
  useEffect(() => {
    startCam();
    return () => stopCam();
  }, [startCam, stopCam]);

  const sendRef = useRef(room.send);
  useEffect(() => { sendRef.current = room.send; }, [room.send]);

  const handleRelease = useCallback(async () => {
    const result = await recorder.finishRecording();
    const sentence = result?.sentence;
    if (!sentence) return;
    setLastResult(sentence);
    // The backend already returns a finished English sentence; forward it as-is.
    sendRef.current("sign", sentence);
    record("signer", sentence);
  }, [recorder, record]);

  // Desktop: tap Space to start recording, tap again to stop (frees both hands).
  const recorderRef = useRef(recorder);
  useEffect(() => { recorderRef.current = recorder; });
  const releaseRef = useRef(handleRelease);
  useEffect(() => { releaseRef.current = handleRelease; });
  useEffect(() => {
    const isTyping = (el: EventTarget | null) => {
      const n = el as HTMLElement | null;
      return !!n && (n.tagName === "INPUT" || n.tagName === "TEXTAREA" || n.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || isTyping(e.target)) return;
      e.preventDefault();
      const r = recorderRef.current;
      if (r.processing) return;
      if (r.recording) releaseRef.current();
      else if (r.cameraReady) r.beginRecording();
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, []);

  // Incoming: speech -> avatar
  const [sentences, setSentences] = useState<SentenceSegment[]>([]);
  const [pendingText, setPendingText] = useState("");
  const [busy, setBusy] = useState(false);
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const onMessage = room.onMessage;
  useEffect(() => {
    const unsubscribe = onMessage((msg) => {
      if (msg.kind !== "speech" || !msg.text?.trim()) return;
      const text = msg.text.trim();
      setPendingText(text);
      record("speaker", text);
      setBusy(true);
      queueRef.current = queueRef.current.then(async () => {
        try {
          const gloss = await textToGloss(text);
          const { sigml, fingerspelled } = await glossToSigml(gloss);
          setSentences((prev) => [...prev, { transcription: text, gloss, sigml, fingerspelled }]);
        } finally {
          setBusy(false);
          setPendingText("");
        }
      });
    }, true);
    return unsubscribe;
  }, [onMessage, record]);

  return (
    <div className="flex flex-col gap-3">
      {/* Incoming speech as avatar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Speaker says
          </p>
          {busy && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
        </div>
        <SiGMLDisplay
          sentences={sentences}
          currentSegment={{}}
          avatar={settings.avatar}
        />
        <p className="mt-1.5 text-sm text-foreground min-h-[1.25rem]">
          {pendingText
            ? `“${pendingText}”`
            : sentences.length > 0
            ? `“${sentences[sentences.length - 1].transcription}”`
            : ""}
        </p>
      </div>

      {/* Outgoing sign capture */}
      <div className="s2s-card p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            You sign
          </p>
          <button
            onClick={() => update({ showLandmarks: !settings.showLandmarks })}
            className={`inline-flex items-center gap-1.5 text-[11px] font-bold transition-colors ${
              settings.showLandmarks ? "text-primary" : "text-muted-foreground hover:text-primary"
            }`}
            title="Toggle hand landmark overlay"
          >
            <Hand className="w-3.5 h-3.5" />
            {settings.showLandmarks ? "Landmarks on" : "Landmarks off"}
          </button>
        </div>
        <div className="relative rounded-2xl overflow-hidden bg-ink h-[215px] shadow-card">
          <video
            ref={recorder.videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay playsInline muted
            style={{ transform: "scaleX(-1)" }}
          />
          <canvas
            ref={overlayRef}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            style={{ transform: "scaleX(-1)" }}
          />
          {recorder.recording && (
            <div className="absolute top-3 right-3 bg-recording text-recording-foreground rounded-full px-3 py-1.5 text-xs font-bold inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Recording
            </div>
          )}
          {!recorder.cameraReady && (
            <div className="absolute inset-0 grid place-items-center text-white/80 text-sm">
              Starting camera...
            </div>
          )}
        </div>

        <div className="mt-2 min-h-[1.75rem] text-center">
          {recorder.processing ? (
            <span className="inline-flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Translating...
            </span>
          ) : lastResult ? (
            <span className="font-display font-extrabold text-primary text-base leading-snug">
              {lastResult}
            </span>
          ) : (
            <span className="text-muted-foreground/60 italic text-sm">
              Your translated sentence appears here.
            </span>
          )}
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <HoldButton
            recording={recorder.recording}
            processing={recorder.processing}
            disabled={!recorder.cameraReady}
            icon={<Video className="w-7 h-7" />}
            onDown={recorder.beginRecording}
            onUp={handleRelease}
            toggle
          />
          <p className="text-xs font-semibold text-muted-foreground transition-colors">
            {recorder.processing
              ? "Translating..."
              : recorder.recording
              ? "Tap to stop"
              : !recorder.cameraReady
              ? "Starting camera..."
              : "Tap to start, sign, tap to stop"}
          </p>
        </div>
        {recorder.error && <p className="mt-2 text-xs text-destructive">{recorder.error}</p>}
      </div>
    </div>
  );
}
