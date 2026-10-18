"use client";

import React, { useCallback, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { PageShell } from "@/app/components/shell/PageShell";
import { SignAvatar, AvatarClip } from "@/app/components/avatar/SignAvatar";
import { MicButton } from "@/app/components/primitives/MicButton";
import { useLiveSpeech } from "@/app/hooks/useLiveSpeech";
import { textToSign } from "@/app/lib/pipeline/backend";

export default function CompanionPage() {
  const [clips, setClips] = useState<AvatarClip[]>([]);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const idRef = useRef(0);

  const signText = useCallback((raw: string) => {
    const phrase = raw.trim();
    if (!phrase) return;
    setCaption(phrase);
    setError("");
    queueRef.current = queueRef.current
      .then(async () => {
        const { sigml, nonManual } = await textToSign(phrase);
        if (!sigml.trim()) throw new Error(`No signs were produced for "${phrase}".`);
        setClips((prev) => [...prev, { id: idRef.current++, sigml, nonManual }]);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const speech = useLiveSpeech({ onFinal: signText });
  const problem = error || speech.error;

  const statusChip = (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${speech.listening ? "text-emerald-400" : "text-white/45"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${speech.listening ? "bg-emerald-400 animate-pulse" : "bg-white/30"}`} />
      {speech.listening ? "Live" : "Off"}
    </span>
  );

  return (
    <PageShell title="Companion" subtitle="Sign along in a call" action={statusChip} dark className="gap-4">
      <div className="flex-1 flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)] lg:gap-10 lg:items-center">
      <SignAvatar clips={clips} variant="stage" showGlosses className="flex-1 min-h-[360px] w-full lg:min-h-[560px] lg:h-[calc(100vh-190px)]" />

      <div className="flex flex-col gap-4 lg:gap-8">
      <div className="min-h-[2.5rem] text-center lg:text-left" aria-live="polite">
        <p className="hidden lg:block s2s-label text-white/45 mb-3">From the call</p>
        {speech.interim ? (
          <p className="text-white/70 text-[16px] lg:text-[26px] font-medium leading-snug">{speech.interim}</p>
        ) : caption ? (
          <p className="font-display font-extrabold text-white text-[18px] lg:text-[36px] leading-snug lg:leading-tight">{caption}</p>
        ) : (
          <p className="text-white/45 text-sm">{speech.supported ? "Start listening and speak, or let the call's audio play near the microphone." : "Live speech needs Chrome or Edge."}</p>
        )}
        {problem && (
          <p className="mt-1.5 flex items-center justify-center gap-1.5 text-[12px] font-semibold text-rose-300">
            <TriangleAlert className="w-3.5 h-3.5 shrink-0" /> {problem}
          </p>
        )}
      </div>

      {speech.supported && (
        <div className="flex flex-col items-center gap-2 lg:flex-row lg:gap-4">
          <MicButton listening={speech.listening} onToggle={speech.listening ? speech.stop : speech.start} size={68} />
          <p className="text-[12px] font-semibold text-white/55">{speech.listening ? "Listening" : "Tap to start listening"}</p>
        </div>
      )}
      <p className="text-center lg:text-left text-[11px] lg:text-[13px] text-white/35 leading-relaxed">Keep this window beside your call, or share it into the meeting.</p>
      </div>
      </div>
    </PageShell>
  );
}
