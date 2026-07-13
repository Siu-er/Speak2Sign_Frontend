"use client";

import React from "react";
import Link from "next/link";
import { Mic, Video, Sparkles } from "lucide-react";
import { AppShell } from "@/app/components/shell/AppShell";
import { TopHeader } from "@/app/components/shell/TopHeader";

export default function HomePage() {
  return (
    <AppShell>
      <TopHeader />

      <main className="px-6 flex-1 flex flex-col pb-6">
        <div className="animate-fade-up" style={{ animationDelay: "40ms" }}>
          <p className="s2s-eyebrow mb-3 inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-dot" />
            Real-time AI translation
          </p>
          <h1 className="s2s-heading text-[44px] leading-[1.05] mb-3">
            How would you like to communicate?
          </h1>
          <p className="text-muted-foreground text-[15px] leading-relaxed max-w-[85%]">
            Choose your communication mode to start transcribing or translating
            instantly.
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <RoleCard
            href="/pair?role=speaker"
            icon={<Mic className="w-7 h-7" />}
            title="I speak"
            description="Speak and we'll translate sign language"
            delay={120}
            surface="primary"
          />
          <RoleCard
            href="/pair?role=signer"
            icon={<Video className="w-7 h-7" />}
            title="I sign"
            description="Sign and we'll convert to text and speech"
            delay={200}
            surface="ink"
          />
        </div>

        <div className="mt-auto pt-8">
          <div
            className="s2s-card flex items-start gap-3 p-4 animate-fade-up"
            style={{ animationDelay: "320ms" }}
          >
            <div className="w-9 h-9 grid place-items-center rounded-2xl bg-primary-soft text-primary">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-foreground flex items-center gap-1.5">
                AI is Ready
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
              </p>
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                Real-time low-latency communication enabled.
              </p>
            </div>
          </div>
        </div>
      </main>
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
  const surfaceCls =
    surface === "primary" ? "s2s-surface-primary" : "s2s-surface-ink";
  return (
    <Link
      href={href}
      className="group block animate-fade-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className={`relative overflow-hidden rounded-[28px] px-6 py-7 shadow-pill transition-transform duration-300 group-hover:-translate-y-0.5 group-active:scale-[0.99] ${surfaceCls}`}
      >
        <div
          className="absolute left-1/2 -top-16 w-52 h-52 -translate-x-1/2 rounded-full opacity-25"
          style={{
            background:
              "radial-gradient(circle, rgba(255,255,255,0.8) 0%, transparent 62%)",
          }}
        />
        <div className="relative flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full grid place-items-center bg-white/15 backdrop-blur transition-transform duration-300 group-hover:scale-105">
            {icon}
          </div>
          <h3 className="mt-5 text-2xl font-extrabold tracking-tight">{title}</h3>
          <p className="mt-1.5 text-sm opacity-80 leading-relaxed max-w-[80%]">{description}</p>
        </div>
      </div>
    </Link>
  );
}
