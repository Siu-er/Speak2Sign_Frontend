"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { AppShell } from "@/app/components/shell/AppShell";
import { S2SLogo } from "@/app/components/shell/S2SLogo";
import { SignAvatar, AvatarClip } from "@/app/components/avatar/SignAvatar";
import { textToSign, SignResult } from "@/app/lib/pipeline/backend";

// Each sentence signs entirely from the dictionary and shows a different part of ASL grammar.
const SENTENCES = [
  { text: "Nice to meet you.", note: "ASL word order: NICE MEET YOU" },
  { text: "Do you want to grab a coffee together?", note: "Brows go up for a yes or no question" },
  { text: "What is your name?", note: "Brows come down for a what question" },
];

// Signs the recogniser knows, for visitors to try on the camera.
const SIGN_BACK = ["HELLO", "YES", "PLEASE", "FRIEND"];

// Pause between sentences while Vy cycles through them.
const GAP_MS = 2200;

function StepNumber({ n, live }: { n: number; live: boolean }) {
  return (
    <span className="relative z-10 grid place-items-center shrink-0 w-12 h-12 rounded-full p-[3px] s2s-ribbon lg:w-[clamp(52px,3.6vw,64px)] lg:h-[clamp(52px,3.6vw,64px)]">
      <span className={`grid place-items-center w-full h-full rounded-full font-extrabold text-[20px] lg:text-[clamp(20px,1.6vw,26px)] transition-colors duration-500 ${live ? "bg-primary text-white" : "bg-white text-primary"}`}>
        {n}
      </span>
    </span>
  );
}

/** One step: its number on the timeline and a card. `beside` puts the step's visual to the right of its text on wide screens. */
function Step({ n, live = false, beside = false, delay, title, body, children }: { n: number; live?: boolean; beside?: boolean; delay: number; title: string; body: string; children: React.ReactNode }) {
  return (
    <li className="relative flex gap-4 animate-fade-up lg:gap-6" style={{ animationDelay: `${delay}ms` }}>
      <StepNumber n={n} live={live} />
      <div
        className={`flex-1 min-w-0 rounded-[28px] p-5 s2s-card transition-[background-color,box-shadow] duration-500 lg:p-[clamp(18px,1.5vw,28px)] ${
          beside ? "lg:flex lg:items-center lg:gap-6" : ""
        } ${live ? "bg-white shadow-pill-soft" : ""}`}
      >
        <div className="min-w-0 lg:flex-1">
          <h3 className="font-extrabold tracking-tight text-foreground text-[20px] leading-tight lg:text-[clamp(21px,1.65vw,29px)]">{title}</h3>
          <p className="mt-1 text-muted-foreground font-medium text-[14px] lg:text-[clamp(14px,1.05vw,18px)]">{body}</p>
        </div>
        <div className={beside ? "mt-4 lg:mt-0 lg:shrink-0" : "mt-3 lg:mt-[clamp(10px,1.4vh,16px)]"}>{children}</div>
      </div>
    </li>
  );
}

/**
 * The booth's idle screen: three steps to try S2S beside Vy, who signs the
 * suggested sentences in turn. Tapping the sentence opens Live Sign with it.
 */
export default function TryPage() {
  const [origin, setOrigin] = useState("");
  const [prepared, setPrepared] = useState<SignResult[] | null>(null);
  const [error, setError] = useState("");
  const [clips, setClips] = useState<AvatarClip[]>([]);
  const [shown, setShown] = useState(0);
  const [signing, setSigning] = useState(false);
  const nextRef = useRef(0);
  const idRef = useRef(0);
  const sentenceOf = useRef(new Map<number, number>());
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { setOrigin(window.location.origin); }, []);

  useEffect(() => {
    Promise.all(SENTENCES.map((s) => textToSign(s.text)))
      .then(setPrepared)
      .catch((e: Error) => setError(e.message));
  }, []);

  const signNext = useCallback(() => {
    if (!prepared) return;
    const i = nextRef.current;
    nextRef.current = (i + 1) % prepared.length;
    const id = idRef.current++;
    sentenceOf.current.set(id, i);
    setShown(i);
    setClips((prev) => [...prev, { id, sigml: prepared[i].sigml, nonManual: prepared[i].nonManual }]);
  }, [prepared]);

  useEffect(() => { signNext(); }, [signNext]);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const onPlayingChange = useCallback((clip: AvatarClip | null) => {
    if (clip) {
      setSigning(true);
      return;
    }
    setSigning(false);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(signNext, GAP_MS);
  }, [signNext]);

  const sentence = SENTENCES[shown];

  return (
    <AppShell showNav={false}>
      <main className="flex-1 flex flex-col gap-8 px-5 py-6 lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)] lg:gap-[clamp(40px,4vw,80px)] lg:px-[clamp(40px,4vw,80px)] lg:py-[clamp(32px,4vh,56px)] lg:h-screen lg:min-h-[760px]">
        <section className="flex flex-col min-h-0">
          <div className="animate-fade-up">
            <S2SLogo height={56} className="w-auto h-[40px] lg:h-[clamp(44px,4.6vh,60px)]" />
            <h1 className="s2s-heading mt-5 text-[46px] leading-[0.95] lg:mt-[clamp(12px,2.2vh,32px)] lg:text-[clamp(56px,5.4vw,100px)]">Try S2S</h1>
            <p className="mt-3 text-muted-foreground text-[16px] leading-relaxed max-w-[46ch] lg:text-[clamp(16px,1.3vw,23px)]">
              Speech becomes sign, and signing becomes speech.
            </p>
          </div>

          <ol className="relative mt-7 flex flex-col gap-4 lg:mt-auto lg:gap-[clamp(14px,2vh,24px)]">
            <span aria-hidden="true" className="absolute left-6 top-8 bottom-8 w-[3px] -translate-x-1/2 rounded-full s2s-ribbon opacity-40 lg:left-[clamp(26px,1.8vw,32px)]" />

            <Step n={1} delay={120} beside title="Open S2S" body="Scan the code with your phone, or use this screen.">
              <div className="w-fit rounded-2xl bg-white p-2 border border-primary/10">
                {origin && <QRCodeSVG value={origin} size={104} bgColor="#ffffff" fgColor="#1E3A8A" level="M" />}
              </div>
              <p className="mt-2 font-bold text-primary text-[13px] lg:text-[clamp(12px,0.85vw,15px)]">{origin.replace(/^https?:\/\//, "")}</p>
            </Step>

            <Step n={2} delay={220} live={signing} title="Say a sentence" body="Speak or type it on Live Sign. Vy signs it in ASL.">
              <Link
                href={`/live?say=${encodeURIComponent(sentence.text)}`}
                className="group block rounded-[20px] bg-primary-soft/60 px-4 py-3 s2s-press lg:px-5 lg:py-4"
              >
                <span key={shown} className="block animate-fade-up">
                  <span className="flex flex-col-reverse items-start gap-2 lg:flex-row lg:justify-between lg:gap-3">
                    <span className="font-extrabold tracking-tight text-foreground text-[18px] leading-snug lg:text-[clamp(19px,1.6vw,27px)]">&ldquo;{sentence.text}&rdquo;</span>
                    <span className={`shrink-0 lg:mt-1 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-bold transition-colors duration-500 lg:text-[13px] ${signing ? "bg-primary text-white" : "bg-white text-primary"}`}>
                      <span aria-hidden="true" className="flex items-end gap-[3px] h-3">
                        {[0, 1, 2].map((b) => (
                          <span key={b} className={`w-[3px] rounded-full ${signing ? "bg-white animate-pulse" : "bg-primary/50"}`} style={{ height: `${45 + b * 27}%`, animationDelay: `${b * 160}ms` }} />
                        ))}
                      </span>
                      {signing ? "Vy is signing" : "Up next"}
                    </span>
                  </span>
                  <span className="mt-1 block text-[13px] font-semibold text-primary lg:text-[clamp(13px,1vw,17px)]">{sentence.note}</span>
                </span>
              </Link>
            </Step>

            <Step n={3} delay={320} beside title="Sign back" body="Sign to the camera on Practice. S2S speaks for you.">
              <Link href="/practice" className="flex flex-wrap gap-2 s2s-press lg:max-w-[clamp(240px,17vw,320px)] lg:justify-end" aria-label="Practise signing back">
                {SIGN_BACK.map((g) => (
                  <span key={g} className="rounded-full bg-white border border-primary/15 px-4 py-1.5 text-[13px] font-extrabold tracking-wide text-primary lg:text-[clamp(14px,1.05vw,18px)]">{g}</span>
                ))}
              </Link>
            </Step>
          </ol>
        </section>

        <section className="relative flex flex-col min-h-0 animate-fade-up" style={{ animationDelay: "160ms" }}>
          <SignAvatar
            clips={clips}
            variant="stage"
            showGlosses
            onPlayingChange={onPlayingChange}
            className="w-full h-[58vh] min-h-[380px] shadow-glass lg:h-full lg:rounded-[40px]"
          />
          {error && (
            <p className="mt-3 rounded-2xl bg-white/90 px-4 py-3 text-sm font-semibold text-destructive">{error}</p>
          )}
        </section>
      </main>
    </AppShell>
  );
}
