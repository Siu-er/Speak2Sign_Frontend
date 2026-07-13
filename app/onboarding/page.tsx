"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Heart, Sparkles, Users } from "lucide-react";
import { S2SLogo } from "@/app/components/shell/S2SLogo";
import { markOnboarded } from "@/app/lib/config/onboarding";

interface Slide {
  heading: string;
  body: string;
  cta: string;
  badge: { label: string; sub?: string; icon: React.ReactNode };
  tint: string;
  icon: React.ReactNode;
}

const MINT = "linear-gradient(135deg, hsl(var(--illustration-mint-from)), hsl(var(--illustration-mint-to)))";
const BLUE = "linear-gradient(135deg, hsl(var(--primary-bright)), hsl(var(--primary)))";
const MIX = "linear-gradient(135deg, hsl(var(--illustration-mint-from)), hsl(var(--primary-bright)))";

const SLIDES: Slide[] = [
  {
    heading: "Break the silence barrier",
    body: "Real-time communication between hearing and deaf individuals.",
    cta: "Next",
    badge: { label: "Connected", icon: <Heart className="w-4 h-4" /> },
    tint: MINT,
    icon: <Heart className="w-16 h-16" />,
  },
  {
    heading: "Communicate anywhere",
    body: "Order coffee, visit the doctor, chat with friends. S2S works in everyday situations where communication matters most.",
    cta: "Continue",
    badge: { label: "Daily Moment", sub: "Seamless interaction", icon: <Sparkles className="w-4 h-4" /> },
    tint: BLUE,
    icon: <Sparkles className="w-16 h-16" />,
  },
  {
    heading: "Built for everyone",
    body: "Accessible, inclusive, and easy to use for children, adults, and people with all disabilities. No barriers, just connection.",
    cta: "Get Started",
    badge: { label: "Inclusive", icon: <Users className="w-4 h-4" /> },
    tint: MIX,
    icon: <Users className="w-16 h-16" />,
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const last = index === SLIDES.length - 1;

  const finish = () => {
    markOnboarded();
    router.replace("/");
  };

  const advance = () => {
    if (last) finish();
    else setIndex((i) => i + 1);
  };

  return (
    <div className="s2s-shell flex flex-col px-6 pt-6 pb-8">
      <div className="flex items-center justify-between">
        <S2SLogo />
        <button
          onClick={finish}
          className="text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          Skip
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        {/* Illustration */}
        <div className="relative w-full max-w-[280px] aspect-[3/4] mb-10">
          <div
            className="absolute inset-0 rounded-[48%_48%_46%_46%/52%_52%_48%_48%] grid place-items-center text-white/90 shadow-pill"
            style={{ background: slide.tint }}
          >
            {slide.icon}
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 shadow-card">
            <span className="w-8 h-8 rounded-xl bg-primary text-primary-foreground grid place-items-center">
              {slide.badge.icon}
            </span>
            <span className="leading-tight">
              <span className="block text-[13px] font-bold text-foreground">{slide.badge.label}</span>
              {slide.badge.sub && (
                <span className="block text-[11px] text-muted-foreground">{slide.badge.sub}</span>
              )}
            </span>
          </div>
        </div>

        <h1 className="s2s-heading text-[34px] leading-[1.1] text-center px-2">
          {slide.heading}
        </h1>
        <p className="mt-4 text-center text-muted-foreground text-[15px] leading-relaxed px-2">
          {slide.body}
        </p>
      </div>

      <button
        onClick={advance}
        className="s2s-pill-primary h-14 w-full inline-flex items-center justify-center gap-2 text-base"
      >
        {slide.cta}
        <ArrowRight className="w-5 h-5" />
      </button>

      <div className="mt-6 flex items-center justify-center gap-2">
        {SLIDES.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i === index ? "w-6 bg-primary" : "w-1.5 bg-primary/25"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
