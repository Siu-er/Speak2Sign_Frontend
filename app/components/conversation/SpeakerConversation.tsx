"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { Chip } from "@/app/components/primitives/Chip";
import { HoldButton } from "@/app/components/conversation/HoldButton";
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

  const { listening, interim, supported, start, stop } = useLiveSpeech({ onFinal });

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

  const lastSentence = sentences[sentences.length - 1] || "";

  return (
    <div className="flex flex-col gap-3">
      {/* Incoming signs */}
      <div className="s2s-card p-4 min-h-[6.5rem]">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Signer says</p>
          <button onClick={() => setSpeakEnabled((v) => !v)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
            {speakEnabled ? <><Volume2 className="w-4 h-4" /> Voice on</> : <><VolumeX className="w-4 h-4" /> Muted</>}
          </button>
        </div>
        {lastSentence ? (
          <p className="font-display font-extrabold text-foreground text-[24px] leading-[1.2] tracking-tight">{lastSentence}</p>
        ) : (
          <p className="text-muted-foreground/70 italic">Waiting for the signer...</p>
        )}
      </div>

      {/* Outgoing speech */}
      <div className="s2s-card p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">You speak</p>
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
          <p className="text-center text-xs text-destructive mb-2">Live speech not supported in this browser. Use Chrome.</p>
        )}

        <div className="flex flex-col items-center gap-1.5">
          <HoldButton
            recording={listening}
            processing={false}
            icon={listening ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
            onDown={listening ? stop : start}
            onUp={() => {}}
            toggle
          />
          <p className="text-xs font-semibold text-muted-foreground">
            {listening ? "Tap to stop" : "Tap to speak"}
          </p>
        </div>
      </div>
    </div>
  );
}
