"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface Props {
  /** Where the back control leads. */
  backHref: string;
  title?: string;
  /** Short line under the title saying what the page is for. */
  subtitle?: string;
  action?: React.ReactNode;
  dark?: boolean;
}

/** The single header used by every page that sits below Home. */
export function PageHeader({ backHref, title, subtitle, action, dark = false }: Props) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 px-5 pt-5 pb-2 lg:static lg:px-12 lg:pt-10 lg:pb-6">
      <Link
        href={backHref}
        aria-label="Back"
        className={`lg:hidden w-10 h-10 shrink-0 grid place-items-center rounded-full border backdrop-blur-xl s2s-press ${
          dark
            ? "bg-white/10 border-white/15 text-white/85 hover:text-white"
            : "bg-white/80 border-white text-foreground hover:text-primary shadow-pill-soft"
        }`}
      >
        <ArrowLeft className="w-[18px] h-[18px]" />
      </Link>
      {title && (
        <div className="min-w-0 text-center leading-tight lg:text-left lg:flex-1">
          <h1 className={`font-display font-extrabold tracking-tight text-[17px] truncate lg:text-[34px] lg:leading-[1.1] ${dark ? "text-white" : "text-foreground"}`}>
            {title}
          </h1>
          {subtitle && (
            <p className={`text-[12px] font-medium truncate lg:mt-1.5 lg:text-[15px] ${dark ? "text-white/55" : "text-muted-foreground"}`}>{subtitle}</p>
          )}
        </div>
      )}
      <div className="w-10 lg:w-auto flex justify-end shrink-0">{action}</div>
    </header>
  );
}
