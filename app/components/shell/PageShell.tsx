"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface Props {
  title: string;
  eyebrow?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  /** Extra classes for the scrollable main region. */
  className?: string;
  /** Dark theme (for overlay-style surfaces). */
  dark?: boolean;
}

/**
 * The centered mobile frame shared by the feature pages, matching the home
 * screen: a max-width column over the app's ambient background, with a compact
 * back-header. Keeps every surface phone-sized and visually consistent.
 */
export function PageShell({ title, eyebrow, action, children, className = "", dark = false }: Props) {
  return (
    <div className={`s2s-shell flex flex-col ${dark ? "s2s-shell-dark" : ""}`}>
      <header className="flex items-center justify-between px-5 pt-5 pb-1.5">
        <Link
          href="/"
          aria-label="Home"
          className={`w-9 h-9 grid place-items-center rounded-full border shadow-pill-soft transition-colors ${
            dark ? "bg-white/10 border-white/15 text-white/80 hover:text-white" : "bg-white/80 border-primary/10 text-foreground hover:text-primary"
          }`}
        >
          <ArrowLeft className="w-[18px] h-[18px]" />
        </Link>
        <div className="text-center leading-tight">
          {eyebrow && (
            <p className={`text-[10px] font-bold uppercase tracking-[0.18em] ${dark ? "text-white/50" : "text-primary"}`}>{eyebrow}</p>
          )}
          <h1 className={`font-display font-extrabold tracking-tight text-[17px] ${dark ? "text-white" : "text-foreground"}`}>{title}</h1>
        </div>
        <div className="w-9 flex justify-end">{action}</div>
      </header>
      <main className={`flex-1 flex flex-col min-h-0 px-5 pb-6 ${className}`}>{children}</main>
    </div>
  );
}
