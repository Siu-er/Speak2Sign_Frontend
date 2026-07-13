'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Card } from "@/app/components/ui/card";
import { User, RotateCcw } from 'lucide-react';

interface SentenceSegment {
  transcription: string;
  gloss: string;
  sigml: string;
  fingerspelled?: string[];
}

interface SiGMLDisplayProps {
  sentences: SentenceSegment[];
  currentSegment: Partial<SentenceSegment>;
  avatar?: string;
}

/**
 * Renders the CWASA sign avatar inside an isolated iframe. CWASA and MediaPipe
 * are both non-modularized emscripten apps and corrupt each other's globals
 * when sharing one document, so the avatar lives in its own frame and receives
 * SiGML over postMessage.
 */
export const SiGMLDisplay: React.FC<SiGMLDisplayProps> = ({ sentences, currentSegment, avatar = "luna" }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const playedRef = useRef(0);
  const pendingRef = useRef<string[]>([]);
  const replay = useCallback(() => {
    const frame = iframeRef.current?.contentWindow;
    const last = sentences[sentences.length - 1];
    if (frame && last?.sigml) frame.postMessage({ type: "s2s-play", sigml: last.sigml }, "*");
  }, [sentences]);

  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      if (ev.source !== iframeRef.current?.contentWindow) return;
      if (ev.data?.type === 's2s-avatar-ready') {
        setReady(true);
        const frame = iframeRef.current?.contentWindow;
        if (frame) {
          for (const sigml of pendingRef.current) {
            frame.postMessage({ type: 's2s-play', sigml }, '*');
          }
          pendingRef.current = [];
        }
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Forward any newly arrived sentence's SiGML to the avatar frame.
  useEffect(() => {
    if (sentences.length <= playedRef.current) return;
    const fresh = sentences.slice(playedRef.current);
    playedRef.current = sentences.length;
    const frame = iframeRef.current?.contentWindow;
    for (const seg of fresh) {
      if (!seg.sigml?.trim()) continue;
      if (ready && frame) {
        frame.postMessage({ type: 's2s-play', sigml: seg.sigml }, '*');
      } else {
        pendingRef.current.push(seg.sigml);
      }
    }
  }, [sentences, ready]);

  useEffect(() => {
    if (sentences.length === 0) playedRef.current = 0;
  }, [sentences.length]);

  const hasContent = sentences.length > 0 || !!currentSegment.sigml?.trim();
  const latestSigml = sentences.length > 0 ? sentences[sentences.length - 1].sigml : (currentSegment.sigml || '');
  const latestSpelled = sentences.length > 0 ? (sentences[sentences.length - 1].fingerspelled ?? []) : [];

  return (
    <Card className="p-3 bg-gradient-subtle border-2 border-accent/20 shadow-soft">
      <div className="space-y-2">
        {/* Outer wrapper is shorter than the iframe so the avatar renders at
            full size while its legs are clipped below the fold. */}
        <div className="bg-muted/30 rounded-lg overflow-hidden h-[205px] relative">
          <iframe
            ref={iframeRef}
            src={`/cwasa-frame.html?avatar=${encodeURIComponent(avatar)}`}
            title="Sign avatar"
            className="absolute top-0 left-0 w-full h-[260px] border-0 bg-white"
          />
          {ready && sentences.length > 0 && (
            <button
              onClick={replay}
              className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-3 py-1.5 text-xs font-bold shadow-pill-soft"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Replay
            </button>
          )}
          {!ready && (
            <div className="absolute inset-0 grid place-items-center pointer-events-none text-center">
              <div>
                <User size={48} className="text-accent mx-auto" />
                <p className="text-muted-foreground text-sm">Loading 3D Avatar…</p>
              </div>
            </div>
          )}
        </div>

        {latestSpelled.length > 0 && (
          <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
            <p className="text-xs font-semibold text-amber-700">
              Spelled letter by letter (no sign available):
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {latestSpelled.map((w, i) => (
                <span
                  key={`${w}-${i}`}
                  className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold tracking-wide"
                >
                  {w.replace(/^FS-/, "")}
                </span>
              ))}
            </div>
          </div>
        )}

      </div>
    </Card>
  );
};
