"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home as HomeIcon, History, Settings as SettingsIcon } from "lucide-react";

const TABS = [
  { href: "/", label: "Home", icon: HomeIcon, match: (p: string) => p === "/" },
  { href: "/history", label: "History", icon: History, match: (p: string) => p.startsWith("/history") },
  { href: "/settings", label: "Settings", icon: SettingsIcon, match: (p: string) => p.startsWith("/settings") },
];

export function BottomNav() {
  const pathname = usePathname();
  const activeIndex = TABS.findIndex((t) => t.match(pathname));

  return (
    <nav className="sticky bottom-0 z-30 px-4 pb-4 pt-2 lg:hidden">
      <div className="relative s2s-card rounded-[26px] px-2 py-2 grid grid-cols-3">
        {activeIndex >= 0 && (
          // Sliding highlight under the active tab, with the brand ribbon beneath it.
          <span
            aria-hidden="true"
            className="absolute top-2 bottom-2 rounded-[20px] bg-primary-soft transition-transform duration-500"
            style={{ left: 8, width: `calc((100% - 16px) / 3)`, transform: `translateX(${activeIndex * 100}%)`, transitionTimingFunction: "var(--ease-spring)" }}
          >
            <span className="absolute left-1/2 -translate-x-1/2 bottom-1 h-[3px] w-6 rounded-full s2s-ribbon" />
          </span>
        )}
        {TABS.map((t, i) => {
          const active = i === activeIndex;
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className="relative flex flex-col items-center gap-1 py-2 rounded-[20px] s2s-press"
            >
              <Icon className={`w-5 h-5 transition-colors ${active ? "text-primary stroke-[2.5]" : "text-muted-foreground"}`} />
              <span className={`text-[11px] font-semibold transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}>
                {t.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
