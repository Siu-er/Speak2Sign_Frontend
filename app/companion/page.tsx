"use client";

import React, { useCallback, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { PageShell } from "@/app/components/shell/PageShell";
import { LiveAvatar, AvatarClip } from "@/app/components/live/LiveAvatar";
import { useLiveSpeech } from "@/app/hooks/useLiveSpeech";
import { textToGloss, glossToSigml } from "@/app/lib/pipeline/backend";

export default function CompanionPage() {
  const [clips, setClips] = useState<AvatarClip[]>([]);
  const [caption, setCaption] = useState("");
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const idRef = useRef(0);

  const signText = useCallback((raw: string) => {
    const phrase = raw.trim();
    if (!phrase) return;
    setCaption(phrase);
    queueRef.current = queueRef.current
      .then(async () => {
        const gloss = await textToGloss(phrase);
        const { sigml } = await glossToSigml(gloss);
        if (sigml?.trim()) setClips((prev) => [...prev, { id: idRef.current++, sigml }]);
      })
      .catch(() => { /* keep alive */ });
  }, []);

  const { listening, interim, supported, start, stop } = useLiveSpeech({ onFinal: signText });

  const statusChip = (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${listening ? "text-emerald-400" : "text-white/40"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${listening ? "bg-emerald-400 animate-pulse" : "bg-white/30"}`} />
      {listening ? "Live" : "Off"}
    </span>
  );

  return (
    <PageShell title="Companion" eyebrow="Sign along in a call" action={statusChip} dark className="gap-3">
      <LiveAvatar clips={clips} avw={520} avh={520} className="flex-1 min-h-0 w-full rounded-[26px] bg-gradient-to-b from-slate-100 to-slate-200/70 border border-white/10 shadow-card" />

      <div className="min-h-[2rem] text-center">
        {interim ? (
          <span className="text-white/60 text-[15px] italic">{interim}</span>
        ) : caption ? (
          <span className="font-semibold text-white text-[16px]">{caption}</span>
        ) : (
          <span className="text-white/40 text-sm italic">{supported ? "Press start and speak." : "Live speech not supported here."}</span>
        )}
      </div>

      {supported && (
        <button onClick={listening ? stop : start}
          className={`h-13 py-3.5 rounded-full inline-flex items-center justify-center gap-2 font-bold text-[15px] transition-colors ${listening ? "bg-recording text-white" : "bg-primary text-white"}`}>
          {listening ? <><MicOff className="w-5 h-5" /> Stop</> : <><Mic className="w-5 h-5" /> Start signing</>}
        </button>
      )}
      <p className="text-center text-[11px] text-white/35 leading-relaxed">Pop this out into a small window over your call, or share it into the meeting.</p>
    </PageShell>
  );
}
