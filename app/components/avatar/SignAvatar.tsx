"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { NonManual } from "@/app/lib/pipeline/backend";
import { useSettings } from "@/app/hooks/useSettings";

export interface AvatarClip {
  id: number;
  sigml: string;
  nonManual: NonManual;
}

type Variant = "stage" | "compact" | "thumb";

interface Props {
  clips: AvatarClip[];
  variant?: Variant;
  /** Show the sentence's signs under the avatar, lighting up as each is signed. */
  showGlosses?: boolean;
  /** Offer a control that signs the last sentence again. */
  replayable?: boolean;
  className?: string;
}

/** The gloss of every sign in a SiGML document, in signing order. */
function glossesOf(sigml: string): string[] {
  return Array.from(sigml.matchAll(/<hns_sign\b[^>]*\bgloss="([^"]*)"/g), (m) => m[1].toUpperCase());
}

const RADIUS: Record<Variant, string> = {
  stage: "rounded-[28px]",
  compact: "rounded-[22px]",
  thumb: "rounded-[18px]",
};

/**
 * The signing avatar on its stage. The avatar runs in an isolated frame
 * (/vrm-frame.html) that signs one sentence at a time and reports which sign is
 * on screen, which drives the gloss captions here.
 */
export function SignAvatar({ clips, variant = "stage", showGlosses = false, replayable = false, className = "" }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { settings } = useSettings();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState<AvatarClip | null>(null);
  const [lastPlayed, setLastPlayed] = useState<AvatarClip | null>(null);
  const [signIndex, setSignIndex] = useState(-1);
  // Clips sent to the frame and not yet finished, in the order it plays them.
  const sentRef = useRef<AvatarClip[]>([]);
  const pendingRef = useRef<AvatarClip[]>([]);
  const deliveredRef = useRef(0);

  // A different character loads a fresh frame, which must announce itself
  // again before it can accept sentences.
  useEffect(() => {
    setReady(false);
    setPlaying(null);
    setSignIndex(-1);
    sentRef.current = [];
  }, [settings.avatar]);

  const send = useCallback((clip: AvatarClip) => {
    const frame = iframeRef.current?.contentWindow;
    if (!frame) throw new Error("Avatar frame is not attached");
    sentRef.current.push(clip);
    frame.postMessage({ type: "s2s-play", sigml: clip.sigml, nonManual: clip.nonManual }, "*");
  }, []);

  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      if (ev.source !== iframeRef.current?.contentWindow) return;
      const data = ev.data ?? {};
      if (data.type === "s2s-avatar-ready") {
        setReady(true);
        for (const clip of pendingRef.current) send(clip);
        pendingRef.current = [];
      } else if (data.type === "s2s-sign" && typeof data.index === "number") {
        if (data.index >= 0) {
          setPlaying(sentRef.current[0] ?? null);
          setSignIndex(data.index);
        } else {
          setLastPlayed(sentRef.current.shift() ?? null);
          setPlaying(null);
          setSignIndex(-1);
        }
      } else if (data.type === "s2s-avatar-error" && typeof data.message === "string") {
        sentRef.current.shift();
        setError(data.message);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [send]);

  useEffect(() => {
    const fresh = clips.slice(deliveredRef.current);
    deliveredRef.current = clips.length;
    for (const clip of fresh) {
      setError("");
      if (ready) send(clip);
      else pendingRef.current.push(clip);
    }
  }, [clips, ready, send]);

  const shown = playing ?? lastPlayed;
  const glosses = shown ? glossesOf(shown.sigml) : [];

  return (
    <div className={`relative overflow-hidden isolate ${RADIUS[variant]} ${className}`}>
      {/* Stage: a soft spotlight and a floor shadow under the avatar. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{ background: "radial-gradient(120% 80% at 50% 28%, hsl(0 0% 100%) 0%, hsl(228 45% 95%) 48%, hsl(229 38% 86%) 100%)" }}
      />
      {variant !== "thumb" && (
        <div aria-hidden="true" className="absolute left-1/2 -translate-x-1/2 bottom-[-18px] w-3/4 h-10 rounded-[50%] bg-indigo-950/20 blur-xl -z-10" />
      )}
      <iframe key={settings.avatar} ref={iframeRef} src={`/vrm-frame.html?model=${settings.avatar}`} title="Signing avatar" className="absolute inset-0 w-full h-full border-0 bg-transparent" />

      {!ready && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className="w-2/5 max-w-[140px]">
            <div className="h-1.5 rounded-full s2s-ribbon animate-ribbon-flow" />
            {variant !== "thumb" && <p className="mt-2 text-center text-xs font-semibold text-muted-foreground">Getting the signer ready</p>}
          </div>
        </div>
      )}

      {replayable && ready && lastPlayed && !playing && (
        <button
          onClick={() => send(lastPlayed)}
          className="absolute top-2.5 right-2.5 inline-flex items-center gap-1.5 rounded-full bg-white border border-white px-3 py-1.5 text-xs font-bold text-primary shadow-pill-soft s2s-press"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Replay
        </button>
      )}

      {showGlosses && glosses.length > 0 && (
        <div className="absolute inset-x-2.5 bottom-2.5 flex flex-wrap justify-center gap-1.5" aria-live="polite">
          {glosses.map((g, i) => {
            const active = playing !== null && i === signIndex;
            const done = playing !== null ? i < signIndex : true;
            return (
              <span
                key={`${shown?.id}-${i}`}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide transition-all duration-300 ${
                  active
                    ? "bg-primary text-white scale-110 shadow-pill"
                    : done
                    ? "bg-white/85 text-foreground"
                    : "bg-white/50 text-muted-foreground"
                }`}
              >
                {g}
              </span>
            );
          })}
        </div>
      )}

      {error && (
        <p className="absolute inset-x-3 top-3 rounded-xl bg-white/90 px-3 py-2 text-xs font-semibold text-destructive shadow-pill-soft">{error}</p>
      )}
    </div>
  );
}
