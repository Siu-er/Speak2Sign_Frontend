"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserCircle2 } from "lucide-react";
import { S2SLogo } from "@/app/components/shell/S2SLogo";

interface Props {
  title?: string;
  showBack?: boolean;
  showLogo?: boolean;
  rightAccessory?: React.ReactNode;
  variant?: "default" | "transparent";
}

export function TopHeader({
  title,
  showBack = false,
  showLogo = true,
  rightAccessory,
  variant = "default",
}: Props) {
  const router = useRouter();

  return (
    <header
      className={`relative z-10 px-6 pt-6 pb-4 flex items-center justify-between ${
        variant === "transparent" ? "" : ""
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {showBack && (
          <button
            onClick={() => router.back()}
            className="w-9 h-9 -ml-1 grid place-items-center rounded-full text-primary hover:bg-primary-soft/60 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        {title ? (
          <h2 className="font-display font-bold text-foreground text-base truncate">
            {title}
          </h2>
        ) : (
          showLogo && <S2SLogo />
        )}
      </div>

      <div className="flex items-center gap-2">
        {rightAccessory ?? (
          <Link
            href="/profile"
            className="w-9 h-9 grid place-items-center rounded-full text-muted-foreground hover:text-primary hover:bg-primary-soft/60 transition-colors"
            aria-label="Profile"
          >
            <UserCircle2 className="w-6 h-6" />
          </Link>
        )}
      </div>
    </header>
  );
}
