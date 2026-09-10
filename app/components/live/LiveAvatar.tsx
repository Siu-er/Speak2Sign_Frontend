"use client";

import React, { useEffect, useRef, useState } from "react";

export interface AvatarClip {
  id: number;
  sigml: string;
}

interface Props {
  clips: AvatarClip[];
  avatar?: string;
  className?: string;
  avw?: number;
  avh?: number;
}

/**
 * Full-size CWASA sign avatar. Plays each newly appended clip's SiGML by
 * posting it into the isolated avatar iframe, using the same ready handshake as
 * the conversation view.
 */
export function LiveAvatar({ clips, avatar = "luna", className = "", avw = 620, avh = 560 }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const playedRef = useRef(0);
  const pendingRef = useRef<string[]>([]);

  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      if (ev.source !== iframeRef.current?.contentWindow) return;
      if (ev.data?.type === "s2s-avatar-ready") {
        setReady(true);
        const frame = iframeRef.current?.contentWindow;
        if (frame) {
          for (const sigml of pendingRef.current) frame.postMessage({ type: "s2s-play", sigml }, "*");
          pendingRef.current = [];
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (clips.length <= playedRef.current) return;
    const fresh = clips.slice(playedRef.current);
    playedRef.current = clips.length;
    const frame = iframeRef.current?.contentWindow;
    for (const clip of fresh) {
      if (!clip.sigml?.trim()) continue;
      if (ready && frame) frame.postMessage({ type: "s2s-play", sigml: clip.sigml }, "*");
      else pendingRef.current.push(clip.sigml);
    }
  }, [clips, ready]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <iframe
        ref={iframeRef}
        src={`/cwasa-frame.html?avatar=${encodeURIComponent(avatar)}&avw=${avw}&avh=${avh}`}
        title="Sign avatar"
        className="absolute inset-0 w-full h-full border-0 bg-transparent"
      />
      {!ready && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <p className="text-muted-foreground text-sm animate-pulse">Loading avatar...</p>
        </div>
      )}
    </div>
  );
}
