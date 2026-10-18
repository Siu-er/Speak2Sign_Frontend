"use client";

import React from "react";
import { PageHeader } from "@/app/components/shell/PageHeader";

interface Props {
  title: string;
  /** Short line under the title saying what the page is for. */
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  /** Extra classes for the scrollable main region. */
  className?: string;
  /** Dark theme (for overlay-style surfaces). */
  dark?: boolean;
}

/** The app column for feature pages: the shared header over a padded main region. */
export function PageShell({ title, subtitle, action, children, className = "", dark = false }: Props) {
  return (
    <div className={`s2s-shell flex flex-col ${dark ? "s2s-shell-dark" : ""}`}>
      <PageHeader backHref="/" title={title} subtitle={subtitle} action={action} dark={dark} />
      <main className={`flex-1 flex flex-col min-h-0 px-5 pb-6 ${className}`}>{children}</main>
    </div>
  );
}
