"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { PageShell } from "@/app/components/shell/PageShell";
import { LiveAvatar, AvatarClip } from "@/app/components/live/LiveAvatar";
import { textToGloss, glossToSigml } from "@/app/lib/pipeline/backend";

/**
 * Caption-driven avatar overlay. The Meet companion extension relays the call's
 * live captions here via window.postMessage({ type: "s2s-caption", text }).
 */
export default function OverlayPage() {
  const [clips, setClips] = useState<AvatarClip[]>([]);
  const [caption, setCaption] = useState("");
  const [connected, setConnected] = useState(false);
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

  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      const d = ev.data || {};
      if (d.type === "s2s-caption" && typeof d.text === "string") { setConnected(true); signText(d.text); }
      if (d.type === "s2s-extension-ready") setConnected(true);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [signText]);

  const statusChip = (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${connected ? "text-emerald-400" : "text-amber-400"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`} />
      {connected ? "Live" : "Waiting"}
    </span>
  );

  return (
    <PageShell title="Meet Companion" eyebrow="Captions to signing" action={statusChip} dark className="gap-3">
      <LiveAvatar clips={clips} avw={520} avh={520} className="flex-1 min-h-0 w-full rounded-[26px] bg-gradient-to-b from-slate-100 to-slate-200/70 border border-white/10 shadow-card" />
      <div className="min-h-[2rem] text-center pb-2">
        {caption ? (
          <span className="font-semibold text-white text-[16px]">{caption}</span>
        ) : (
          <span className="text-white/40 text-sm italic">Turn on captions in your meeting.</span>
        )}
      </div>
    </PageShell>
  );
}
