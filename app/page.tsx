"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Mic, Video, Sparkles, BookOpen, Target, MonitorPlay, QrCode, X, ArrowRight } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { AppShell } from "@/app/components/shell/AppShell";
import { TopHeader } from "@/app/components/shell/TopHeader";
import { SignAvatar, AvatarClip } from "@/app/components/avatar/SignAvatar";
import { textToSign } from "@/app/lib/pipeline/backend";

export default function HomePage() {
  const [showQR, setShowQR] = useState(false);
  const [url, setUrl] = useState("");
  const [greeting, setGreeting] = useState<AvatarClip[]>([]);
  const [greetError, setGreetError] = useState("");
  const greeted = useRef(false);

  useEffect(() => { setUrl(window.location.origin); }, []);

  // The avatar greets each visitor with the sign for "hello".
  useEffect(() => {
    if (greeted.current) return;
    greeted.current = true;
    textToSign("Hello")
      .then(({ sigml, nonManual }) => setGreeting([{ id: 0, sigml, nonManual }]))
      .catch((e: Error) => setGreetError(e.message));
  }, []);

  return (
    <AppShell>
      <TopHeader />

      {/* Phones: one column. Desktop: heading and roles on the left, the signer's
          stage on the right, the explore row across the bottom. */}
      <main className="px-5 pb-6 flex-1 flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.82fr)] lg:grid-rows-[auto_1fr_auto] lg:gap-x-10 lg:px-12 lg:pt-12 lg:pb-10">
        <section className="animate-fade-up lg:col-start-1 lg:row-start-1">
          <h1 className="s2s-heading text-[30px] leading-[1.08] lg:text-[56px] lg:leading-[1.02] lg:max-w-[14ch]">How would you like to communicate?</h1>
          <p className="mt-2 text-muted-foreground text-[14px] leading-relaxed max-w-[34ch] lg:mt-4 lg:text-[18px] lg:max-w-[40ch]">
            Start a live conversation, or explore the other ways to use sign language.
          </p>
        </section>

        <Link
          href="/live"
          className="mt-5 s2s-card s2s-press s2s-lift flex items-stretch gap-3 p-2.5 animate-fade-up lg:mt-0 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:flex-col lg:gap-0 lg:p-3 lg:rounded-[32px]"
          style={{ animationDelay: "80ms" }}
        >
          <SignAvatar clips={greeting} variant="thumb" className="w-[112px] h-[132px] shrink-0 lg:w-full lg:h-auto lg:flex-1 lg:min-h-[400px] lg:rounded-[24px] [&_iframe]:pointer-events-none" />
          <div className="flex flex-col justify-center min-w-0 pr-2 lg:px-4 lg:pt-5 lg:pb-3">
            <p className="font-display font-extrabold text-[17px] leading-tight text-foreground lg:text-[24px]">Say something, see it signed</p>
            <p className="mt-1 text-[13px] text-muted-foreground leading-snug lg:text-[15px]">
              {greetError ? `The signer could not greet you: ${greetError}` : "Speech and text become ASL, signed live."}
            </p>
            <span className="mt-2.5 inline-flex items-center gap-1 text-[13px] font-bold text-primary">
              Open Live Sign <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </Link>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:col-start-1 lg:row-start-2 lg:self-start lg:mt-12 lg:gap-5">
          <RoleCard href="/pair?role=speaker" icon={<Mic className="w-6 h-6" />} title="I speak" description="Talk, we translate to sign" delay={140} surface="primary" />
          <RoleCard href="/pair?role=signer" icon={<Video className="w-6 h-6" />} title="I sign" description="Sign, we voice it" delay={200} surface="ink" />
        </div>

        <div className="lg:col-span-2 lg:row-start-3 lg:mt-10">
        <h2 className="mt-6 mb-2.5 s2s-label text-muted-foreground lg:mt-0 lg:mb-3">Explore</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
          <FeatureTile href="/live" icon={<Sparkles className="w-5 h-5" />} title="Live Sign" subtitle="Speak or type, watch it signed" tint="teal" delay={260} />
          <FeatureTile href="/dictionary" icon={<BookOpen className="w-5 h-5" />} title="Dictionary" subtitle="Look up any sign" tint="indigo" delay={300} />
          <FeatureTile href="/practice" icon={<Target className="w-5 h-5" />} title="Practice" subtitle="Learn signs, get scored" tint="amber" delay={340} />
          <FeatureTile href="/companion" icon={<MonitorPlay className="w-5 h-5" />} title="Call Companion" subtitle="Sign along beside a call" tint="violet" delay={380} />
        </div>
        </div>

        <button
          onClick={() => setShowQR(true)}
          className="lg:hidden mt-4 w-full inline-flex items-center justify-center gap-2 py-3 rounded-full s2s-card text-sm font-semibold text-foreground s2s-press animate-fade-up"
          style={{ animationDelay: "420ms" }}
        >
          <QrCode className="w-4 h-4 text-primary" /> Open on another phone
        </button>
      </main>

      {showQR && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 backdrop-blur-sm p-6" onClick={() => setShowQR(false)}>
          <div role="dialog" aria-label="Open S2S on another phone" className="s2s-card p-6 max-w-xs w-full text-center animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="font-display font-bold text-foreground">Scan with another phone</p>
              <button onClick={() => setShowQR(false)} aria-label="Close"><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <div className="grid place-items-center rounded-2xl bg-white p-4 border border-primary/10">
              {url && <QRCodeSVG value={url} size={200} bgColor="#ffffff" fgColor="#1E3A8A" level="M" />}
            </div>
            <p className="mt-3 text-[12px] text-muted-foreground break-all">{url}</p>
          </div>
        </div>
      )}
    </AppShell>
  );
}

interface RoleCardProps {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: number;
  surface: "primary" | "ink";
}

function RoleCard({ href, icon, title, description, delay, surface }: RoleCardProps) {
  const surfaceCls = surface === "primary" ? "s2s-surface-primary" : "s2s-surface-ink";
  return (
    <Link href={href} className="group block animate-fade-up s2s-press" style={{ animationDelay: `${delay}ms` }}>
      <div className={`relative overflow-hidden rounded-[24px] px-4 pt-5 pb-4 shadow-pill s2s-lift lg:rounded-[28px] lg:px-7 lg:pt-7 lg:pb-6 ${surfaceCls}`}>
        <div aria-hidden="true" className="absolute -right-10 -top-12 w-36 h-36 rounded-full opacity-30" style={{ background: "radial-gradient(circle, rgba(255,255,255,0.85) 0%, transparent 62%)" }} />
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 s2s-ribbon opacity-80" />
        <div className="relative">
          <div className="w-11 h-11 rounded-2xl grid place-items-center bg-white/15 border border-white/20">{icon}</div>
          <h3 className="mt-6 text-[21px] font-extrabold tracking-tight lg:mt-14 lg:text-[30px]">{title}</h3>
          <p className="mt-0.5 text-[12px] opacity-80 leading-snug lg:text-[15px]">{description}</p>
        </div>
      </div>
    </Link>
  );
}

const TINTS: Record<string, string> = {
  teal: "bg-teal-500",
  indigo: "bg-indigo-500",
  amber: "bg-amber-500",
  violet: "bg-violet-500",
};

interface FeatureTileProps {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  tint: keyof typeof TINTS;
  delay: number;
}

function FeatureTile({ href, icon, title, subtitle, tint, delay }: FeatureTileProps) {
  return (
    <Link href={href} className="group block s2s-card rounded-[22px] p-4 lg:p-5 s2s-press s2s-lift animate-fade-up" style={{ animationDelay: `${delay}ms` }}>
      <div className={`w-10 h-10 rounded-[14px] grid place-items-center text-white shadow-sm ${TINTS[tint]}`}>{icon}</div>
      <h3 className="mt-3 text-[15px] font-extrabold text-foreground">{title}</h3>
      <p className="mt-0.5 text-[12px] text-muted-foreground leading-snug">{subtitle}</p>
    </Link>
  );
}
