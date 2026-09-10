"use client";

import React from "react";
import { Loader2, Square } from "lucide-react";

interface HoldButtonProps {
  recording: boolean;
  processing: boolean;
  disabled?: boolean;
  /** Icon shown in the idle state. */
  icon: React.ReactNode;
  onDown: () => void;
  onUp: () => void;
  /** Tap-to-start / tap-to-stop instead of press-and-hold (frees both hands). */
  toggle?: boolean;
}

/**
 * Circular record control. Idle shows a soft surface with the mode icon;
 * recording fills it and emits an expanding ring. In hold mode it records while
 * held; in toggle mode one tap starts and the next stops.
 */
export function HoldButton({ recording, processing, disabled, icon, onDown, onUp, toggle }: HoldButtonProps) {
  const handlers = toggle
    ? {
        onClick: () => {
          if (recording) onUp();
          else onDown();
        },
      }
    : {
        onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); onDown(); },
        onPointerUp: (e: React.PointerEvent) => { e.preventDefault(); onUp(); },
        onPointerLeave: () => { if (recording) onUp(); },
      };
  return (
    <button
      disabled={disabled}
      {...handlers}
      onContextMenu={(e) => e.preventDefault()}
      className="relative w-[68px] h-[68px] rounded-full grid place-items-center select-none touch-none outline-none transition-transform duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
      aria-pressed={recording}
    >
      {recording && <span className="s2s-record-ring absolute inset-1 rounded-full" />}
      <span
        className={`relative z-10 w-[68px] h-[68px] rounded-full grid place-items-center transition-all duration-300 ${
          recording
            ? "bg-gradient-stop text-white shadow-pill scale-105"
            : processing
            ? "bg-primary text-primary-foreground shadow-pill"
            : "bg-primary-soft text-primary shadow-pill-soft hover:scale-[1.03]"
        }`}
      >
        {processing ? (
          <Loader2 className="w-7 h-7 animate-spin" />
        ) : recording ? (
          <Square className="w-6 h-6 fill-current" />
        ) : (
          icon
        )}
      </span>
    </button>
  );
}
