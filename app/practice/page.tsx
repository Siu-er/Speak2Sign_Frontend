"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Video, Loader2, RotateCcw, Check, X, Trophy, TriangleAlert } from "lucide-react";
import { PageShell } from "@/app/components/shell/PageShell";
import { SignAvatar, AvatarClip } from "@/app/components/avatar/SignAvatar";
import { Celebration } from "@/app/components/primitives/Celebration";
import { useSignRecorder } from "@/app/hooks/useSignRecorder";
import { useHandOverlay } from "@/app/hooks/useHandOverlay";
import { textToSign } from "@/app/lib/pipeline/backend";

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
  const [demoError, setDemoError] = useState("");
  const idRef = useRef(0);

  const startCam = recorder.start;
  const stopCam = recorder.stop;
  useEffect(() => { startCam(); return () => stopCam(); }, [startCam, stopCam]);

  const demo = useCallback(async (word: string) => {
    setDemoError("");
    try {
      const { sigml, nonManual } = await textToSign(word);
      if (!sigml.trim()) throw new Error(`No sign was produced for "${word}".`);
      setClips((prev) => [...prev, { id: idRef.current++, sigml, nonManual }]);
    } catch (e) {
      setDemoError(e instanceof Error ? e.message : String(e));
    }
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
    <PageShell title="Practice" subtitle="Copy the sign" action={scoreChip} className="gap-3 items-center">
      {/* target */}
      <div className="text-center lg:-mt-2">
        <p className="s2s-label text-muted-foreground">Sign this word</p>
        <p className="font-display font-extrabold text-[34px] lg:text-[48px] text-primary capitalize leading-tight">{target}</p>
        {streak >= 2 && <p className="text-[12px] font-bold text-amber-600">{streak} in a row</p>}
        {demoError && <p className="mt-1 inline-flex items-center gap-1.5 text-[12px] font-semibold text-destructive"><TriangleAlert className="w-3.5 h-3.5" /> {demoError}</p>}
      </div>

      {/* Phones show the signer, then the camera, in one stage; desktop shows them side by side. */}
      <div className={`relative w-full flex-1 min-h-[340px] rounded-[28px] overflow-hidden shadow-lift lg:grid lg:grid-cols-2 lg:gap-6 lg:overflow-visible lg:rounded-none lg:shadow-none lg:bg-transparent lg:min-h-[480px] lg:h-[calc(100vh-330px)] ${phase === "watch" ? "" : "bg-ink"}`}>
        <div className={`absolute inset-0 transition-opacity duration-300 lg:static lg:opacity-100 lg:pointer-events-auto lg:rounded-[28px] lg:overflow-hidden lg:shadow-lift ${phase === "watch" ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
          <SignAvatar clips={clips} variant="stage" showGlosses className="w-full h-full rounded-none" />
          <span className="hidden lg:block absolute top-4 left-4 rounded-full bg-white px-3 py-1 text-[12px] font-bold text-foreground shadow-pill-soft">Watch</span>
        </div>
        <div className={`absolute inset-0 transition-opacity duration-300 lg:relative lg:opacity-100 lg:pointer-events-auto lg:rounded-[28px] lg:overflow-hidden lg:bg-ink lg:shadow-lift ${phase !== "watch" ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
          <video ref={recorder.videoRef} className="absolute inset-0 w-full h-full object-cover" autoPlay playsInline muted style={{ transform: "scaleX(-1)" }} />
          <canvas ref={overlayRef} className="absolute inset-0 w-full h-full object-cover pointer-events-none" style={{ transform: "scaleX(-1)" }} />
          {recorder.recording && (
            <div className="absolute top-3 right-3 bg-recording text-white rounded-full px-3 py-1.5 text-xs font-bold inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Recording
            </div>
          )}
          <span className="hidden lg:block absolute top-4 left-4 rounded-full bg-white/15 px-3 py-1 text-[12px] font-bold text-white">Your turn</span>
        {phase === "result" && (
          <div className={`absolute inset-0 grid place-items-center backdrop-blur-sm ${correct ? "bg-emerald-500/30" : "bg-ink/45"}`}>
            {correct && <Celebration />}
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
      </div>

      {/* controls */}
      <div className="w-full lg:max-w-xl">
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
