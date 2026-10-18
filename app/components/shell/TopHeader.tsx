"use client";

import React from "react";
import Link from "next/link";
import { UserCircle2 } from "lucide-react";
import { S2SLogo } from "@/app/components/shell/S2SLogo";

/** Phone header for the tab pages: the logo and a way to your profile. Desktop uses the sidebar. */
export function TopHeader() {
  return (
    <header className="relative z-10 px-6 pt-6 pb-4 flex items-center justify-between lg:hidden">
      <S2SLogo />
      <Link
        href="/profile"
        className="w-9 h-9 grid place-items-center rounded-full text-muted-foreground hover:text-primary hover:bg-primary-soft/60 transition-colors"
        aria-label="Your profile"
      >
        <UserCircle2 className="w-6 h-6" />
      </Link>
    </header>
  );
}
