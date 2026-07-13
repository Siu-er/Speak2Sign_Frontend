"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Loader2, Volume2, VolumeX, Languages } from "lucide-react";
import { Chip } from "@/app/components/primitives/Chip";
import { HoldButton } from "@/app/components/conversation/HoldButton";
import { useSpeechCapture } from "@/app/hooks/useSpeechCapture";
import { useRoom } from "@/app/hooks/useRoom";
import { useSettings } from "@/app/hooks/useSettings";
import { useConversationLog } from "@/app/hooks/useConversationLog";
import { languageNeedsTranslation, VoiceTone } from "@/app/lib/config/settings";
import { audioToText, signToSentence } from "@/app/lib/pipeline/backend";

const TONE_PARAMS: Record<VoiceTone, { rate: number; pitch: number }> = {
  Natural: { rate: 1.0, pitch: 1.0 },
  Warm: { rate: 0.95, pitch: 0.9 },
  Crisp: { rate: 1.08, pitch: 1.12 },
  Robotic: { rate: 0.85, pitch: 0.6 },
};

type Phase = "idle" | "listening" | "processing" | "sent";

/** Speaker device: holds to record speech, receives signs as text + TTS. */
export function SpeakerConversation() {
  const capture = useSpeechCapture();
  const room = useRoom();
  const { settings } = useSettings();
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  const { record } = useConversationLog();

  // --- Outgoing: speech capture ---
  const [phase, setPhase] = useState<Phase>("idle");
  const [transcription, setTranscription] = useState("");
  const [error, setError] = useState("");
  // When on, Whisper translates any spoken language to English. Default from the
  // chosen language in Settings.
  const [translateMode, setTranslateMode] = useState(() =>
    languageNeedsTranslation(settings.language),
  );
  const translateRef = useRef(false);
  useEffect(() => { translateRef.current = translateMode; }, [translateMode]);

  // Open the mic on mount so the level meter is live before recording.
  const startMic = capture.start;
  const stopMic = capture.stop;
  useEffect(() => {
    startMic();
    return () => stopMic();
  }, [startMic, stopMic]);

  const beginListening = useCallback(() => {
    setError("");
    setTranscription("");
    setPhase("listening");
    capture.beginRecording();
  }, [capture]);

  const finishAndSend = useCallback(async () => {
    if (phase !== "listening") return;
    const result = capture.finishRecording();
    if (!result) {
      setError("No audio captured.");
      setPhase("idle");
      return;
    }
    setPhase("processing");
    try {
      const text = await audioToText(result.wav, { translate: translateRef.current });
      if (!text) {
        setError("No speech detected.");
        setPhase("idle");
        return;
      }
      setTranscription(text);
      room.send("speech", text);
      record("speaker", text);
      setPhase("sent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transcription failed");
      setPhase("idle");
    }
  }, [phase, capture, room, record]);

  // Desktop: hold Space to record speech (mirror of holding the button).
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; });
  const beginRef = useRef(beginListening);
  useEffect(() => { beginRef.current = beginListening; });
  const finishRef = useRef(finishAndSend);
  useEffect(() => { finishRef.current = finishAndSend; });
  useEffect(() => {
    const isTyping = (el: EventTarget | null) => {
      const n = el as HTMLElement | null;
      return !!n && (n.tagName === "INPUT" || n.tagName === "TEXTAREA" || n.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || isTyping(e.target)) return;
      e.preventDefault();
      if (phaseRef.current !== "listening" && phaseRef.current !== "processing") beginRef.current();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space" || isTyping(e.target)) return;
      e.preventDefault();
      if (phaseRef.current === "listening") finishRef.current();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // --- Incoming: a signed phrase refined into a sentence + spoken ---
  // The signer records a whole phrase per hold-release, so each message carries
  // the full gloss sequence of one sentence. Refine those glosses into natural
  // English with the LLM and speak it as one utterance.
  const [sentences, setSentences] = useState<string[]>([]);
  const [current, setCurrent] = useState<string[]>([]);
  const [speakEnabled, setSpeakEnabled] = useState(false);
  const speakRef = useRef(false);

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

  const [forming, setForming] = useState(false);
  const finalize = useCallback(async (words: string[]) => {
    if (!words.length) return;
    setCurrent(words);
    setForming(true);
    try {
      const sentence = await signToSentence(words);
      setSentences((prev) => [...prev, sentence]);
      record("signer", sentence);
      speak(sentence);
    } catch {
      setError("Could not form a sentence from the signs.");
    } finally {
      setForming(false);
      setCurrent([]);
    }
  }, [speak, record]);

  const onMessage = room.onMessage;
  useEffect(() => {
    const unsubscribe = onMessage((msg) => {
      if (msg.kind !== "sign" || !msg.text?.trim()) return;
      finalize(msg.text.trim().split(/\s+/));
    }, true);
    return unsubscribe;
  }, [onMessage, finalize]);

  const lastSentence = sentences[sentences.length - 1] || "";
  const building = current.join(" ");

  return (
    <div className="flex flex-col gap-3">
      {/* Incoming signs */}
      <div className="s2s-card p-4 min-h-[6.5rem]">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Signer says
          </p>
          <button
            onClick={() => setSpeakEnabled((v) => !v)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
          >
            {speakEnabled ? (
              <><Volume2 className="w-4 h-4" /> Voice on</>
            ) : (
              <><VolumeX className="w-4 h-4" /> Muted</>
            )}
          </button>
        </div>
        {lastSentence || building ? (
          <>
            {lastSentence && (
              <p className="font-display font-extrabold text-foreground text-[24px] leading-[1.2] tracking-tight">
                {lastSentence}
              </p>
            )}
            {building && (
              <p className="mt-1 text-muted-foreground text-[15px] italic">
                {building}
                <span className="ml-0.5 inline-block w-[2px] h-[1em] bg-primary translate-y-0.5 animate-pulse" />
              </p>
            )}
          </>
        ) : forming ? (
          <p className="inline-flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Forming sentence...
          </p>
        ) : (
          <p className="text-muted-foreground/70 italic">Waiting for the signer...</p>
        )}
      </div>

      {/* Outgoing speech */}
      <div className="s2s-card p-4">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setTranslateMode((v) => !v)}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground hover:text-primary"
            title="Toggle spoken language"
          >
            <Languages className="w-3.5 h-3.5" />
            {translateMode ? "Any language" : "English"}
          </button>
          {phase === "sent" ? (
            <Chip tone="success" size="sm" className="gap-1.5">Sent</Chip>
          ) : (
            <Chip tone={phase === "listening" ? "amber" : "success"} size="sm" className="gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${phase === "listening" ? "bg-recording animate-pulse" : "bg-emerald-500"}`} />
              {phase === "listening" ? "Recording" : "Mic ready"}
            </Chip>
          )}
        </div>

        <div className="flex items-end justify-center gap-1.5 h-11 mb-2">
          {capture.bands.map((v, i) => {
            const h = capture.isActive ? Math.max(0.06, v) : 0.06;
            const hot = phase === "listening";
            return (
              <span
                key={i}
                className={`w-1.5 rounded-full transition-all ${hot ? "bg-gradient-to-b from-recording to-primary" : "bg-gradient-to-b from-primary-bright to-primary"}`}
                style={{ height: `${h * 100}%`, opacity: 0.4 + h * 0.6, transitionDuration: "90ms" }}
              />
            );
          })}
        </div>
        <div className="h-1.5 rounded-full bg-secondary overflow-hidden mb-3">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${Math.min(100, Math.round(capture.level * 240))}%`, transitionDuration: "90ms" }}
          />
        </div>

        <div className="min-h-[2rem] mb-3 text-center">
          {phase === "processing" ? (
            <span className="inline-flex items-center gap-2 text-muted-foreground text-[15px]">
              <Loader2 className="w-4 h-4 animate-spin" /> Transcribing...
            </span>
          ) : transcription ? (
            <span className="text-foreground text-[15px] font-medium animate-fade-up">
              &ldquo;{transcription}&rdquo;
            </span>
          ) : (
            <span className="text-muted-foreground/60 italic text-[15px]">
              Your transcription appears here.
            </span>
          )}
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <HoldButton
            recording={phase === "listening"}
            processing={phase === "processing"}
            icon={<Mic className="w-7 h-7" />}
            onDown={beginListening}
            onUp={finishAndSend}
          />
          <p className="text-xs font-semibold text-muted-foreground transition-colors">
            {phase === "processing"
              ? "Transcribing..."
              : phase === "listening"
              ? "Release to send"
              : phase === "sent"
              ? "Hold to speak again"
              : "Hold to speak"}
          </p>
        </div>

        {(error || capture.error) && (
          <p className="mt-3 text-center text-xs text-destructive">{error || capture.error}</p>
        )}
      </div>
    </div>
  );
}
