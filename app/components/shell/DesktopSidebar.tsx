"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Home, Sparkles, BookOpen, Target, MonitorPlay, History, Settings, UserRound } from "lucide-react";
import { S2SLogo } from "@/app/components/shell/S2SLogo";

const SECTIONS = [
  {
    items: [
      { href: "/", label: "Home", icon: Home, match: (p: string) => p === "/" || p.startsWith("/pair") || p.startsWith("/scan") || p.startsWith("/conversation") },
      { href: "/live", label: "Live Sign", icon: Sparkles, match: (p: string) => p.startsWith("/live") },
      { href: "/dictionary", label: "Dictionary", icon: BookOpen, match: (p: string) => p.startsWith("/dictionary") },
      { href: "/practice", label: "Practice", icon: Target, match: (p: string) => p.startsWith("/practice") },
      { href: "/companion", label: "Call Companion", icon: MonitorPlay, match: (p: string) => p.startsWith("/companion") },
    ],
  },
  {
    items: [
      { href: "/history", label: "History", icon: History, match: (p: string) => p.startsWith("/history") },
      { href: "/settings", label: "Settings", icon: Settings, match: (p: string) => p.startsWith("/settings") },
      { href: "/profile", label: "You", icon: UserRound, match: (p: string) => p.startsWith("/profile") },
    ],
  },
];

// Screens that are complete on their own: the Meet side panel and the introduction.
const STANDALONE = ["/meet", "/onboarding"];

/**
 * Desktop navigation: every section of the app, and a QR code that opens S2S
 * on a phone. It stays mounted across pages; only the active marker moves.
 */
export function DesktopSidebar() {
  const pathname = usePathname();
  // The QR code always opens the app's start page, whichever page is showing.
  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);

  if (STANDALONE.some((p) => pathname.startsWith(p))) return null;

  return (
    <aside className="s2s-sidebar hidden lg:flex fixed inset-y-0 left-0 z-40 w-[264px] flex-col p-4">
      <div className="rounded-[30px] flex-1 flex flex-col p-4 min-h-0 bg-white border border-white shadow-glass">
        <Link href="/" className="px-2 pt-2 pb-5" aria-label="S2S home">
          <S2SLogo height={44} />
        </Link>
        <nav className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-5" aria-label="Sections">
          {SECTIONS.map((section, si) => (
            <ul key={si} className="flex flex-col gap-1">
              {section.items.map((item) => {
                const active = item.match(pathname);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`relative flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[14px] font-semibold transition-colors ${
                        active ? "bg-primary-soft text-primary" : "text-muted-foreground hover:text-foreground hover:bg-white/70"
                      }`}
                    >
                      {active && <span aria-hidden="true" className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-full s2s-ribbon" />}
                      <Icon className={`w-[18px] h-[18px] ${active ? "stroke-[2.4]" : ""}`} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ))}
        </nav>
        <div className="mt-4 rounded-[22px] bg-white/80 border border-white p-3 flex items-center gap-3">
          <div className="rounded-xl bg-white p-1.5 border border-primary/10 shrink-0">
            {origin && <QRCodeSVG value={origin} size={64} bgColor="#ffffff" fgColor="#1E3A8A" level="M" />}
          </div>
          <p className="text-[12px] leading-snug text-muted-foreground">
            <span className="block font-bold text-foreground text-[13px]">Open on a phone</span>
            Scan to join from your own device.
          </p>
        </div>
      </div>
    </aside>
  );
}
