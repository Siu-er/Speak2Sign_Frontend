"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Video, Loader2, RotateCcw, Check, X, Trophy } from "lucide-react";
import { PageShell } from "@/app/components/shell/PageShell";
import { LiveAvatar, AvatarClip } from "@/app/components/live/LiveAvatar";
import { useSignRecorder } from "@/app/hooks/useSignRecorder";
import { useHandOverlay } from "@/app/hooks/useHandOverlay";
import { textToGloss, glossToSigml } from "@/app/lib/pipeline/backend";

const WORDS = ["sign", "people", "talk", "deaf", "learn", "name", "help", "work", "good", "happy", "book", "school", "friend", "family"];

type Phase = "watch" | "record" | "checking" | "result";

export default function PracticePage() {
  const recorder = useSignRecorder();
  const overlayRef = useRef<HTMLCanvasElement>(null);
  useHandOverlay(recorder.videoRef, overlayRef, true);

  const [target, setTarget] = useState(WORDS[0]);
  const [phase, setPhase] = useState<Phase>("watch");
  const [clips, setClips] = useState<AvatarClip[]>([]);
  const [recognized, setRecognized] = useState<string[]>([]);
  const [correct, setCorrect] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const idRef = useRef(0);

  const startCam = recorder.start;
  const stopCam = recorder.stop;
  useEffect(() => { startCam(); return () => stopCam(); }, [startCam, stopCam]);

  const demo = useCallback(async (word: string) => {
    try {
      const gloss = await textToGloss(word);
      const { sigml } = await glossToSigml(gloss);
      if (sigml?.trim()) setClips((prev) => [...prev, { id: idRef.current++, sigml }]);
    } catch { /* best-effort demo */ }
  }, []);

  useEffect(() => { demo(target); }, [target, demo]);

  const nextWord = useCallback(() => {
    const pool = WORDS.filter((w) => w !== target);
    setTarget(pool[Math.floor(Math.random() * pool.length)]);
    setPhase("watch");
    setRecognized([]);
    setCorrect(false);
  }, [target]);

  const stopAndCheck = useCallback(async () => {
    setPhase("checking");
    const result = await recorder.finishRecording();
    const gloss = (result?.gloss ?? []).map((g) => g.toLowerCase());
    setRecognized(gloss);
    const hit = gloss.includes(target.toLowerCase());
    setCorrect(hit);
    if (hit) { setScore((s) => s + 1); setStreak((s) => s + 1); }
    else setStreak(0);
    setPhase("result");
  }, [recorder, target]);

  const control = useMemo(() => ({
    begin: () => { setPhase("record"); recorder.beginRecording(); },
    stop: stopAndCheck,
  }), [recorder, stopAndCheck]);

  const scoreChip = (
    <div className="inline-flex items-center gap-1 text-sm font-bold text-foreground">
      <Trophy className="w-4 h-4 text-amber-500" /> {score}
    </div>
  );

  return (
    <PageShell title="Practice" eyebrow="Copy the sign" action={scoreChip} className="gap-3 items-center">
      {/* target */}
      <div className="text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Sign this word</p>
        <p className="font-display font-extrabold text-[34px] text-primary capitalize leading-tight">{target}</p>
        {streak >= 2 && <p className="text-[11px] font-bold text-amber-600">{streak} in a row</p>}
      </div>

      {/* stage */}
      <div className="relative w-full flex-1 min-h-0 rounded-[26px] overflow-hidden shadow-card bg-ink border border-white/10">
        <div className={`absolute inset-0 transition-opacity duration-300 ${phase === "watch" ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
          <LiveAvatar clips={clips} avw={520} avh={520} className="w-full h-full bg-gradient-to-b from-slate-100 to-slate-200/70" />
        </div>
        <div className={`absolute inset-0 transition-opacity duration-300 ${phase !== "watch" ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
          <video ref={recorder.videoRef} className="absolute inset-0 w-full h-full object-cover" autoPlay playsInline muted style={{ transform: "scaleX(-1)" }} />
          <canvas ref={overlayRef} className="absolute inset-0 w-full h-full object-cover pointer-events-none" style={{ transform: "scaleX(-1)" }} />
          {recorder.recording && (
            <div className="absolute top-3 right-3 bg-recording text-white rounded-full px-3 py-1.5 text-xs font-bold inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Recording
            </div>
          )}
        </div>
        {phase === "result" && (
          <div className={`absolute inset-0 grid place-items-center backdrop-blur-sm ${correct ? "bg-emerald-500/30" : "bg-ink/45"}`}>
            <div className="text-center animate-fade-up px-6">
              <div className={`w-20 h-20 rounded-full grid place-items-center mx-auto shadow-pill ${correct ? "bg-emerald-500" : "bg-white/90"}`}>
                {correct ? <Check className="w-10 h-10 text-white" /> : <X className="w-10 h-10 text-recording" />}
              </div>
              <p className="mt-3 font-display font-extrabold text-2xl text-white drop-shadow">{correct ? "Nailed it!" : "Not quite"}</p>
              {recognized.length > 0 && <p className="text-white/85 text-sm mt-1">Saw: {recognized.join(", ")}</p>}
            </div>
          </div>
        )}
      </div>

      {/* controls */}
      <div className="w-full">
        {phase === "watch" && (
          <div className="flex gap-2.5">
            <button onClick={() => demo(target)} className="shrink-0 w-14 h-14 rounded-full grid place-items-center bg-white/85 border border-primary/10 text-foreground shadow-pill-soft" title="Watch again">
              <RotateCcw className="w-5 h-5" />
            </button>
            <button onClick={control.begin} disabled={!recorder.cameraReady} className="flex-1 h-14 rounded-full bg-primary text-white font-bold text-base inline-flex items-center justify-center gap-2 shadow-pill disabled:opacity-50">
              <Video className="w-5 h-5" /> {recorder.cameraReady ? "I'll try it" : "Starting camera..."}
            </button>
          </div>
        )}
        {phase === "record" && (
          <button onClick={control.stop} className="w-full h-14 rounded-full bg-recording text-white font-bold text-base inline-flex items-center justify-center gap-2 shadow-pill animate-pulse">Stop and check</button>
        )}
        {phase === "checking" && (
          <div className="h-14 inline-flex w-full items-center justify-center gap-2 text-muted-foreground font-semibold"><Loader2 className="w-5 h-5 animate-spin" /> Reading your sign...</div>
        )}
        {phase === "result" && (
          <div className="flex gap-2.5">
            <button onClick={() => setPhase("watch")} className="flex-1 h-14 rounded-full bg-white/85 border border-primary/10 text-foreground font-bold inline-flex items-center justify-center gap-2 shadow-pill-soft"><RotateCcw className="w-4 h-4" /> Retry</button>
            <button onClick={nextWord} className="flex-1 h-14 rounded-full bg-primary text-white font-bold inline-flex items-center justify-center gap-2 shadow-pill">Next word</button>
          </div>
        )}
      </div>
    </PageShell>
  );
}
