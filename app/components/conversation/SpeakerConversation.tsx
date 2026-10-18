"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Chip } from "@/app/components/primitives/Chip";
import { MicButton } from "@/app/components/primitives/MicButton";
import { useRoom } from "@/app/hooks/useRoom";
import { useSettings } from "@/app/hooks/useSettings";
import { useConversationLog } from "@/app/hooks/useConversationLog";
import { useLiveSpeech } from "@/app/hooks/useLiveSpeech";
import { VoiceTone } from "@/app/lib/config/settings";

const TONE_PARAMS: Record<VoiceTone, { rate: number; pitch: number }> = {
  Natural: { rate: 1.0, pitch: 1.0 },
  Warm: { rate: 0.95, pitch: 0.9 },
  Crisp: { rate: 1.08, pitch: 1.12 },
  Robotic: { rate: 0.85, pitch: 0.6 },
};

/** Speaker device: tap to start/stop live speech; browser STT sends each phrase. */
export function SpeakerConversation() {
  const room = useRoom();
  const { settings } = useSettings();
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  const { record } = useConversationLog();

  const [transcription, setTranscription] = useState("");
  const [speakEnabled, setSpeakEnabled] = useState(false);
  const speakRef = useRef(false);

  const [sentences, setSentences] = useState<string[]>([]);

  const sendRef = useRef(room.send);
  useEffect(() => { sendRef.current = room.send; }, [room.send]);

  const onFinal = useCallback((text: string) => {
    setTranscription(text);
    sendRef.current("speech", text);
    record("speaker", text);
  }, [record]);

  const { listening, interim, supported, error: speechError, start, stop } = useLiveSpeech({ onFinal });

  // Spacebar toggle
  useEffect(() => {
    const isTyping = (el: EventTarget | null) => {
      const n = el as HTMLElement | null;
      return !!n && (n.tagName === "INPUT" || n.tagName === "TEXTAREA" || n.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || isTyping(e.target)) return;
      e.preventDefault();
      if (listening) stop(); else start();
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [listening, start, stop]);

  useEffect(() => {
    speakRef.current = speakEnabled;
    if (!speakEnabled && typeof window !== "undefined") window.speechSynthesis?.cancel();
  }, [speakEnabled]);

  const speak = useCallback((text: string) => {
    if (!speakRef.current || typeof window === "undefined") return;
    const synth = window.speechSynthesis;
    if (!synth) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    const tone = TONE_PARAMS[settingsRef.current.voiceTone];
    utter.rate = Math.min(2, Math.max(0.5, tone.rate * settingsRef.current.playbackSpeed));
    utter.pitch = tone.pitch;
    synth.speak(utter);
  }, []);

  const onMessage = room.onMessage;
  useEffect(() => {
    const unsubscribe = onMessage((msg) => {
      if (msg.kind !== "sign" || !msg.text?.trim()) return;
      const sentence = msg.text.trim();
      setSentences((prev) => [...prev, sentence]);
      record("signer", sentence);
      speak(sentence);
    }, true);
    return unsubscribe;
  }, [onMessage, speak, record]);

  // The signer's recent sentences, newest last; older ones fade back.
  const recent = sentences.slice(-3);

  return (
    <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">
      {/* Incoming signs */}
      <div className="s2s-card p-4 min-h-[6.5rem]">
        <div className="flex items-center justify-between mb-2">
          <p className="s2s-label text-muted-foreground">Signer says</p>
          <button onClick={() => setSpeakEnabled((v) => !v)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
            {speakEnabled ? <><Volume2 className="w-4 h-4" /> Voice on</> : <><VolumeX className="w-4 h-4" /> Muted</>}
          </button>
        </div>
        {recent.length > 0 ? (
          <div className="flex flex-col gap-2" aria-live="polite">
            {recent.map((sentence, i) => {
              const newest = i === recent.length - 1;
              return (
                <p
                  key={sentences.length - recent.length + i}
                  className={`self-start max-w-[92%] rounded-[18px] rounded-bl-md px-3.5 py-2 leading-snug ${
                    newest
                      ? "bg-ink text-white font-display font-extrabold text-[20px] animate-scale-in"
                      : "bg-white/70 text-muted-foreground text-[14px] font-semibold"
                  }`}
                >
                  {sentence}
                </p>
              );
            })}
          </div>
        ) : (
          <p className="text-muted-foreground">Waiting for the signer to sign.</p>
        )}
      </div>

      {/* Outgoing speech */}
      <div className="s2s-card p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="s2s-label text-muted-foreground">You speak</p>
          {listening ? (
            <Chip tone="amber" size="sm" className="gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-recording animate-pulse" /> Listening
            </Chip>
          ) : (
            <Chip tone="success" size="sm" className="gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Mic ready
            </Chip>
          )}
        </div>

        <div className="min-h-[2rem] mb-3 text-center">
          {interim ? (
            <span className="text-primary/70 text-[15px] italic">{interim}</span>
          ) : transcription ? (
            <span className="text-foreground text-[15px] font-medium animate-fade-up">&ldquo;{transcription}&rdquo;</span>
          ) : (
            <span className="text-muted-foreground/60 italic text-[15px]">Your transcription appears here.</span>
          )}
        </div>

        {!supported && (
          <p className="text-center text-xs text-destructive mb-2">Live speech needs Chrome or Edge.</p>
        )}
        {speechError && <p className="text-center text-xs font-semibold text-destructive mb-2">{speechError}</p>}

        <div className="flex flex-col items-center gap-2 pt-1">
          <MicButton listening={listening} onToggle={listening ? stop : start} size={72} disabled={!supported} />
          <p className="text-xs font-semibold text-muted-foreground">
            {listening ? "Tap to stop" : "Tap to speak"}
          </p>
        </div>
      </div>
    </div>
  );
}
