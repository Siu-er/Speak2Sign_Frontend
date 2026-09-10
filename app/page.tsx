"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Mic, Video, Sparkles, BookOpen, Target, MonitorPlay, QrCode, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { AppShell } from "@/app/components/shell/AppShell";
import { TopHeader } from "@/app/components/shell/TopHeader";

export default function HomePage() {
  const [showQR, setShowQR] = useState(false);
  const [url, setUrl] = useState("");
  useEffect(() => { setUrl(window.location.origin); }, []);

  return (
    <AppShell>
      <TopHeader />

      <main className="px-6 pb-6 flex-1 overflow-y-auto">
        <div className="animate-fade-up" style={{ animationDelay: "40ms" }}>
          <p className="s2s-eyebrow mb-2 inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-dot" />
            Real-time AI translation
          </p>
          <h1 className="s2s-heading text-[30px] leading-[1.1] mb-1.5">
            How would you like to communicate?
          </h1>
          <p className="text-muted-foreground text-[14px] leading-relaxed max-w-[88%]">
            Start a live conversation, or explore the other ways to use sign language.
          </p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <RoleCard
            href="/pair?role=speaker"
            icon={<Mic className="w-6 h-6" />}
            title="I speak"
            description="Talk, we translate to sign"
            delay={120}
            surface="primary"
          />
          <RoleCard
            href="/pair?role=signer"
            icon={<Video className="w-6 h-6" />}
            title="I sign"
            description="Sign, we voice it"
            delay={180}
            surface="ink"
          />
        </div>

        <p className="mt-6 mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Explore
        </p>
        <div className="grid grid-cols-2 gap-3">
          <FeatureTile href="/live" icon={<Sparkles className="w-5 h-5" />} title="Live Sign" subtitle="Speak or type, watch it signed" tint="teal" delay={240} />
          <FeatureTile href="/dictionary" icon={<BookOpen className="w-5 h-5" />} title="Dictionary" subtitle="Look up any sign" tint="indigo" delay={300} />
          <FeatureTile href="/practice" icon={<Target className="w-5 h-5" />} title="Practice" subtitle="Learn signs, get scored" tint="amber" delay={360} />
          <FeatureTile href="/companion" icon={<MonitorPlay className="w-5 h-5" />} title="Meet Companion" subtitle="Sign along in a call" tint="violet" delay={420} />
        </div>

        <button
          onClick={() => setShowQR(true)}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-full bg-white border border-primary/15 text-sm font-semibold text-foreground shadow-pill-soft hover:border-primary/40 animate-fade-up"
          style={{ animationDelay: "480ms" }}
        >
          <QrCode className="w-4 h-4 text-primary" /> Scan to try on your phone
        </button>
      </main>

      {showQR && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 backdrop-blur-sm p-6" onClick={() => setShowQR(false)}>
          <div className="s2s-card p-6 max-w-xs w-full text-center animate-fade-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Open on your phone</p>
              <button onClick={() => setShowQR(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <div className="grid place-items-center rounded-2xl bg-white p-4 border border-primary/10">
              {url && <QRCodeSVG value={url} size={200} bgColor="#ffffff" fgColor="#0f766e" level="M" />}
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
    <Link href={href} className="group block animate-fade-up" style={{ animationDelay: `${delay}ms` }}>
      <div className={`relative overflow-hidden rounded-[24px] px-5 py-5 shadow-pill transition-transform duration-300 group-hover:-translate-y-0.5 group-active:scale-[0.99] ${surfaceCls}`}>
        <div
          className="absolute left-1/2 -top-14 w-44 h-44 -translate-x-1/2 rounded-full opacity-25"
          style={{ background: "radial-gradient(circle, rgba(255,255,255,0.8) 0%, transparent 62%)" }}
        />
        <div className="relative flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full grid place-items-center bg-white/15 backdrop-blur transition-transform duration-300 group-hover:scale-105">
            {icon}
          </div>
          <h3 className="mt-2.5 text-xl font-extrabold tracking-tight">{title}</h3>
          <p className="mt-0.5 text-[12px] opacity-80 leading-snug">{description}</p>
        </div>
      </div>
    </Link>
  );
}

const TINTS: Record<string, { bg: string; icon: string; ring: string }> = {
  teal: { bg: "bg-teal-50", icon: "bg-teal-500 text-white", ring: "hover:border-teal-300" },
  indigo: { bg: "bg-indigo-50", icon: "bg-indigo-500 text-white", ring: "hover:border-indigo-300" },
  amber: { bg: "bg-amber-50", icon: "bg-amber-500 text-white", ring: "hover:border-amber-300" },
  violet: { bg: "bg-violet-50", icon: "bg-violet-500 text-white", ring: "hover:border-violet-300" },
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
  const t = TINTS[tint];
  return (
    <Link
      href={href}
      className={`group block rounded-[22px] p-4 border border-transparent ${t.bg} ${t.ring} shadow-pill-soft transition-all duration-300 hover:-translate-y-0.5 animate-fade-up`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`w-10 h-10 rounded-2xl grid place-items-center ${t.icon} shadow-sm transition-transform group-hover:scale-105`}>
        {icon}
      </div>
      <h3 className="mt-3 text-[15px] font-extrabold text-foreground">{title}</h3>
      <p className="mt-0.5 text-[12px] text-muted-foreground leading-snug">{subtitle}</p>
    </Link>
  );
}
