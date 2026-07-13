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
}

/**
 * Circular hold-to-record control. Idle shows a soft surface with the mode
 * icon; holding fills it and emits an expanding ring. Pointer up (or leaving
 * the button while held) releases.
 */
export function HoldButton({ recording, processing, disabled, icon, onDown, onUp }: HoldButtonProps) {
  return (
    <button
      disabled={disabled}
      onPointerDown={(e) => { e.preventDefault(); onDown(); }}
      onPointerUp={(e) => { e.preventDefault(); onUp(); }}
      onPointerLeave={() => { if (recording) onUp(); }}
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
