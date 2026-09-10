"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Send, Globe } from "lucide-react";
import { PageShell } from "@/app/components/shell/PageShell";
import { LiveAvatar, AvatarClip } from "@/app/components/live/LiveAvatar";
import { useLiveSpeech } from "@/app/hooks/useLiveSpeech";
import { useSpeechCapture } from "@/app/hooks/useSpeechCapture";
import { textToGloss, glossToSigml, audioToText } from "@/app/lib/pipeline/backend";

const PHRASES = ["Hello, nice to meet you", "Thank you", "How are you?", "I need help", "Please wait", "Goodbye"];

export default function LivePage() {
  const [clips, setClips] = useState<AvatarClip[]>([]);
  const [captions, setCaptions] = useState<string[]>([]);
  const [spelled, setSpelled] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [name, setName] = useState("");

  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const idRef = useRef(0);

  const signText = useCallback((raw: string) => {
    const phrase = raw.trim();
    if (!phrase) return;
    setCaptions((prev) => [...prev.slice(-3), phrase]);
    setBusy(true);
    queueRef.current = queueRef.current
      .then(async () => {
        const gloss = await textToGloss(phrase);
        const { sigml, fingerspelled } = await glossToSigml(gloss);
        if (sigml?.trim()) setClips((prev) => [...prev, { id: idRef.current++, sigml }]);
        setSpelled(fingerspelled.map((w) => w.replace(/^FS-/, "")));
      })
      .catch(() => { /* keep the kiosk alive */ })
      .finally(() => setBusy(false));
  }, []);

  const { listening, interim, supported, start, stop } = useLiveSpeech({ onFinal: signText });

  const [translateMode, setTranslateMode] = useState(false);
  const capture = useSpeechCapture();
  const captureStart = capture.start;
  const captureStop = capture.stop;
  useEffect(() => {
    if (translateMode) { if (listening) stop(); captureStart(); }
    else captureStop();
  }, [translateMode, captureStart, captureStop, listening, stop]);

  const holdStart = useCallback(() => { if (translateMode) capture.beginRecording(); }, [translateMode, capture]);
  const holdEnd = useCallback(async () => {
    if (!translateMode) return;
    const res = capture.finishRecording();
    if (!res) return;
    try {
      const t = await audioToText(res.wav, { translate: true });
      if (t) signText(t);
    } catch { /* keep alive */ }
  }, [translateMode, capture, signText]);

  const submitText = (e: React.FormEvent) => { e.preventDefault(); signText(text); setText(""); };
  const submitName = (e: React.FormEvent) => { e.preventDefault(); if (name.trim()) signText(name.trim()); };

  return (
    <PageShell title="Live Sign" eyebrow="Say it, see it signed" className="gap-3">
      {/* avatar stage */}
      <div className="flex-1 min-h-0 flex flex-col">
        <LiveAvatar clips={clips} avw={520} avh={520} className="w-full flex-1 min-h-0 rounded-[26px] shadow-card bg-gradient-to-b from-slate-100 to-slate-200/70 border border-white/60" />
        <div className="mt-2.5 min-h-[1.75rem] text-center">
          {interim ? (
            <span className="text-primary/70 text-[15px] italic">{interim}</span>
          ) : captions.length > 0 ? (
            <span className="font-display font-extrabold text-foreground text-[17px]">&ldquo;{captions[captions.length - 1]}&rdquo;</span>
          ) : (
            <span className="text-muted-foreground/60 italic text-sm">Tap the mic, type, or pick a phrase.</span>
          )}
        </div>
        {spelled.length > 0 && (
          <div className="mt-1 flex flex-wrap justify-center gap-1.5">
            {spelled.map((w, i) => (
              <span key={`${w}-${i}`} className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold tracking-wide">{w}</span>
            ))}
          </div>
        )}
      </div>

      {/* controls */}
      <div className="space-y-2.5">
        <div className="flex justify-center">
          <div className="inline-flex rounded-full bg-white/80 border border-primary/10 p-0.5 shadow-pill-soft text-[13px] font-semibold">
            <button onClick={() => setTranslateMode(false)} className={`px-3 py-1 rounded-full transition-colors ${!translateMode ? "bg-primary text-white" : "text-muted-foreground"}`}>English</button>
            <button onClick={() => setTranslateMode(true)} className={`px-3 py-1 rounded-full inline-flex items-center gap-1.5 transition-colors ${translateMode ? "bg-primary text-white" : "text-muted-foreground"}`}>
              <Globe className="w-3.5 h-3.5" /> Any language
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {translateMode ? (
            <button onPointerDown={holdStart} onPointerUp={holdEnd} onPointerLeave={holdEnd} title="Hold and speak any language"
              className="shrink-0 w-14 h-14 rounded-full grid place-items-center text-white shadow-pill bg-primary active:scale-95 select-none touch-none">
              <Globe className="w-6 h-6" />
            </button>
          ) : supported && (
            <button onClick={listening ? stop : start} title={listening ? "Stop" : "Speak"}
              className={`shrink-0 w-14 h-14 rounded-full grid place-items-center text-white shadow-pill transition-transform active:scale-95 ${listening ? "bg-recording animate-pulse" : "bg-primary"}`}>
              {listening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>
          )}
          <form onSubmit={submitText} className="flex-1 flex items-center gap-2 bg-white/90 rounded-full border border-primary/10 px-4 py-2.5 shadow-pill-soft">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type to sign..." className="flex-1 bg-transparent outline-none text-[15px] font-medium min-w-0" />
            <button type="submit" disabled={!text.trim() || busy} className="shrink-0 w-8 h-8 rounded-full grid place-items-center bg-primary text-white disabled:opacity-40">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {PHRASES.map((p) => (
            <button key={p} onClick={() => signText(p)} className="shrink-0 px-3.5 py-1.5 rounded-full bg-white/80 border border-primary/10 text-[13px] font-semibold text-foreground shadow-pill-soft hover:border-primary/40 hover:text-primary transition-colors whitespace-nowrap">{p}</button>
          ))}
        </div>

        <form onSubmit={submitName} className="flex items-center gap-2 bg-white/70 rounded-full border border-primary/10 px-4 py-2 shadow-pill-soft">
          <span className="text-[13px] font-semibold text-muted-foreground shrink-0">Fingerspell:</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="your name" className="flex-1 bg-transparent outline-none text-[14px] font-medium min-w-0" />
          <button type="submit" disabled={!name.trim()} className="shrink-0 px-3.5 py-1 rounded-full bg-ink text-white text-[13px] font-bold disabled:opacity-40">Spell</button>
        </form>
      </div>
    </PageShell>
  );
}
