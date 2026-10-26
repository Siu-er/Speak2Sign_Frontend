"use client";

import React, { useCallback, useRef, useState } from "react";
import { Send, Globe, TriangleAlert } from "lucide-react";
import { PageShell } from "@/app/components/shell/PageShell";
import { SignAvatar, AvatarClip } from "@/app/components/avatar/SignAvatar";
import { MicButton } from "@/app/components/primitives/MicButton";
import { useLiveSpeech } from "@/app/hooks/useLiveSpeech";
import { textToSign, translateToEnglish } from "@/app/lib/pipeline/backend";
import { SPEECH_LANGUAGES, DEFAULT_SPEECH_LANG } from "@/app/lib/config/languages";

const PHRASES = ["Hello, nice to meet you", "Thank you", "How are you?", "I need help", "Please wait", "Goodbye"];

export default function LivePage() {
  const [clips, setClips] = useState<AvatarClip[]>([]);
  const [caption, setCaption] = useState("");
  const [signed, setSigned] = useState<string[]>([]);
  const [source, setSource] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [lang, setLang] = useState<string>(DEFAULT_SPEECH_LANG);

  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const idRef = useRef(0);

  const enqueue = useCallback((work: () => Promise<void>) => {
    setError("");
    setBusy(true);
    queueRef.current = queueRef.current
      .then(work)
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  }, []);

  const signText = useCallback((english: string) => {
    setCaption(english);
    return textToSign(english).then(({ sigml, nonManual }) => {
      if (!sigml.trim()) throw new Error(`No signs were produced for "${english}".`);
      setClips((prev) => [...prev, { id: idRef.current++, sigml, nonManual }]);
      setSigned((prev) => [...prev, english]);
    });
  }, []);

  const say = useCallback((raw: string) => {
    const phrase = raw.trim();
    if (!phrase) return;
    if (lang === DEFAULT_SPEECH_LANG) {
      setSource("");
      enqueue(() => signText(phrase));
    } else {
      setSource(phrase);
      enqueue(() => translateToEnglish(phrase).then(signText));
    }
  }, [lang, enqueue, signText]);

  const speech = useLiveSpeech({ onFinal: say, lang });

  const submitText = (e: React.FormEvent) => {
    e.preventDefault();
    const sentence = text.trim();
    if (!sentence) return;
    setSource("");
    enqueue(() => signText(sentence));
    setText("");
  };
  const submitName = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) { setSource(""); enqueue(() => signText(name.trim())); }
  };

  const problem = error || speech.error;

  return (
    <PageShell title="Live Sign" subtitle="Say it, see it signed" className="gap-3">
      <div className="flex-1 flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(360px,1fr)] lg:gap-8 lg:items-stretch">
        <SignAvatar clips={clips} variant="stage" showGlosses className="w-full flex-1 min-h-[320px] lg:min-h-[560px] lg:h-[calc(100vh-190px)]" />

        <div className="flex flex-col gap-3 lg:gap-5 lg:min-h-0">
          {/* What was heard: live words while speaking, then the settled sentence. */}
          <div className="min-h-[3.25rem] text-center px-2 lg:s2s-card lg:text-left lg:px-6 lg:py-6 lg:min-h-[150px]" aria-live="polite">
            <p className="hidden lg:block s2s-label text-muted-foreground mb-2">Now signing</p>
            {speech.interim ? (
              <p className="text-[17px] lg:text-[24px] font-semibold text-primary/80 leading-snug">
                {speech.interim.split(" ").map((w, i) => (
                  <span key={`${i}-${w}`} className="inline-block animate-fade-up mr-1" style={{ animationDuration: "260ms" }}>{w}</span>
                ))}
              </p>
            ) : caption ? (
              <p className="font-display font-extrabold text-foreground text-[19px] lg:text-[30px] leading-snug lg:leading-tight">{caption}</p>
            ) : (
              <p className="text-muted-foreground text-sm lg:text-base pt-2 lg:pt-0">Speak, type, or pick a phrase below.</p>
            )}
            {source && <p className="mt-1 text-[12px] lg:text-[13px] text-muted-foreground">Heard in your language: {source}</p>}
            {busy && !speech.interim && <div className="mx-auto lg:mx-0 mt-3 h-1 w-20 rounded-full s2s-ribbon animate-ribbon-flow" aria-label="Translating" />}
            {problem && (
              <p className="mt-2 flex items-center justify-center lg:justify-start gap-1.5 text-[12px] lg:text-[13px] font-semibold text-destructive">
                <TriangleAlert className="w-3.5 h-3.5 shrink-0" /> {problem}
              </p>
            )}
          </div>

          <div className="space-y-2.5 lg:space-y-3">
            <div className="flex items-center gap-2.5">
              {speech.supported && <MicButton listening={speech.listening} onToggle={speech.listening ? speech.stop : speech.start} size={56} />}
              <form onSubmit={submitText} className="flex-1 min-w-0 flex items-center gap-2 s2s-card rounded-full px-4 py-2">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type a sentence"
                  aria-label="Sentence to sign"
                  className="flex-1 bg-transparent outline-none text-[15px] font-medium min-w-0 py-1"
                />
                <button type="submit" aria-label="Sign it" disabled={!text.trim() || busy} className="shrink-0 w-9 h-9 rounded-full grid place-items-center bg-gradient-primary text-white disabled:opacity-40 s2s-press">
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>

            <div data-guide="live-phrases" className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 lg:flex-wrap lg:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {PHRASES.map((p, i) => (
                <button
                  key={p}
                  data-guide={i === 0 ? "live-first-phrase" : undefined}
                  onClick={() => { setSource(""); enqueue(() => signText(p)); }}
                  className="shrink-0 px-3.5 py-1.5 rounded-full s2s-card text-[13px] font-semibold text-foreground hover:text-primary whitespace-nowrap s2s-press"
                >
                  {p}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-2.5">
              <form onSubmit={submitName} className="min-w-0 flex items-center gap-2 s2s-card rounded-full pl-4 pr-1.5 py-1.5">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Name to spell"
                  aria-label="Name to fingerspell"
                  className="flex-1 bg-transparent outline-none text-[14px] font-medium min-w-0"
                />
                <button type="submit" disabled={!name.trim()} className="shrink-0 px-3.5 py-1.5 rounded-full bg-ink text-white text-[13px] font-bold disabled:opacity-40 s2s-press">Spell</button>
              </form>
              <label className="inline-flex items-center gap-1.5 s2s-card rounded-full pl-3 pr-2 text-[13px] font-semibold text-foreground">
                <Globe className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="sr-only">Spoken language</span>
                <select
                  value={lang}
                  onChange={(e) => { if (speech.listening) speech.stop(); setLang(e.target.value); setSource(""); }}
                  className="bg-transparent outline-none font-semibold text-[13px] cursor-pointer w-[78px]"
                >
                  {SPEECH_LANGUAGES.map((l) => (
                    <option key={l.tag} value={l.tag}>{l.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {/* Desktop: everything signed in this visit, newest first. */}
          <section className="hidden lg:flex flex-col flex-1 min-h-[140px] s2s-card px-6 py-5">
            <p className="s2s-label text-muted-foreground">This session</p>
            {signed.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Signed sentences collect here.</p>
            ) : (
              <ol className="mt-3 flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
                {[...signed].reverse().map((s, i) => (
                  <li key={signed.length - i} className={`text-[15px] leading-snug ${i === 0 ? "font-bold text-foreground" : "text-muted-foreground"}`}>
                    {s}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </PageShell>
  );
}
