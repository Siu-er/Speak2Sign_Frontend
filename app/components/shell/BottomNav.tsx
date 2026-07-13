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

  return (
    <nav className="sticky bottom-0 z-30">
      <div className="bg-white/95 backdrop-blur-xl rounded-t-[28px] shadow-tab border-t border-white px-3 pt-2.5 pb-4 flex items-stretch">
        {TABS.map((t) => {
          const active = t.match(pathname);
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className="flex-1 flex items-center justify-center"
            >
              <span
                className={`flex flex-col items-center gap-1 px-5 py-1.5 rounded-2xl transition-all duration-300 ${
                  active ? "bg-primary-soft text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className={`w-5 h-5 transition-all ${active ? "stroke-[2.5]" : "stroke-2"}`} />
                <span className={`text-[11px] font-semibold ${active ? "text-primary" : ""}`}>
                  {t.label}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
