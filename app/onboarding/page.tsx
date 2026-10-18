"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { S2SLogo } from "@/app/components/shell/S2SLogo";
import { SignAvatar, AvatarClip } from "@/app/components/avatar/SignAvatar";
import { markOnboarded } from "@/app/lib/config/onboarding";
import { textToSign } from "@/app/lib/pipeline/backend";

interface Slide {
  heading: string;
  body: string;
  cta: string;
  /** What the signer signs while this slide is shown. */
  phrase: string;
}

const SLIDES: Slide[] = [
  {
    heading: "Break the silence barrier",
    body: "Speech becomes ASL signing, and signing becomes speech, live between two people.",
    cta: "Next",
    phrase: "Hello",
  },
  {
    heading: "Communicate anywhere",
    body: "Order coffee, visit the doctor, chat with friends. Pair two phones and talk.",
    cta: "Continue",
    phrase: "Nice to meet you",
  },
  {
    heading: "Made to fit you",
    body: "Choose your signer, the voice, larger text and high contrast in Settings.",
    cta: "Get started",
    phrase: "Welcome",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [clips, setClips] = useState<AvatarClip[]>([]);
  const [error, setError] = useState("");
  const signedRef = useRef(new Set<number>());
  const slide = SLIDES[index];
  const last = index === SLIDES.length - 1;

  // Each slide is signed once, the first time it is shown.
  useEffect(() => {
    if (signedRef.current.has(index)) return;
    signedRef.current.add(index);
    textToSign(SLIDES[index].phrase)
      .then(({ sigml, nonManual }) => setClips((prev) => [...prev, { id: index, sigml, nonManual }]))
      .catch((e: Error) => setError(e.message));
  }, [index]);

  const finish = () => {
    markOnboarded();
    router.replace("/");
  };

  return (
    <div className="s2s-shell flex flex-col px-6 pt-6 pb-8">
      <div className="flex items-center justify-between">
        <S2SLogo />
        <button onClick={finish} className="text-sm font-semibold text-muted-foreground hover:text-foreground">
          Skip
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center py-6">
        <SignAvatar clips={clips} variant="stage" showGlosses className="w-full max-w-[300px] h-[340px] shadow-lift" />
        {error && <p className="mt-2 text-center text-[12px] font-semibold text-destructive">The signer could not load: {error}</p>}

        <div key={index} className="animate-fade-up">
          <h1 className="mt-8 s2s-heading text-[32px] leading-[1.08] text-center">{slide.heading}</h1>
          <p className="mt-3 text-center text-muted-foreground text-[15px] leading-relaxed max-w-[32ch] mx-auto">{slide.body}</p>
        </div>
      </div>

      <button
        onClick={last ? finish : () => setIndex((i) => i + 1)}
        className="s2s-pill-primary h-14 w-full inline-flex items-center justify-center gap-2 text-base s2s-press"
      >
        {slide.cta}
        <ArrowRight className="w-5 h-5" />
      </button>

      <div className="mt-6 flex items-center justify-center gap-2" aria-label={`Step ${index + 1} of ${SLIDES.length}`}>
        {SLIDES.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all duration-500 ${i === index ? "w-8 s2s-ribbon" : "w-1.5 bg-primary/25"}`}
          />
        ))}
      </div>
    </div>
  );
}
