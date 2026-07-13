"use client";

import React from "react";

interface Props {
  value: boolean;
  onChange: (v: boolean) => void;
  /** Use light track when sitting on a dark/primary surface */
  onDark?: boolean;
  ariaLabel?: string;
}

export function Toggle({ value, onChange, onDark = false, ariaLabel }: Props) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors ${
        value ? "bg-primary-bright" : onDark ? "bg-white/30" : "bg-muted"
      }`}
      role="switch"
      aria-checked={value}
      aria-label={ariaLabel}
    >
      <span
        className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
        style={{ left: value ? "calc(100% - 22px)" : "2px" }}
      />
    </button>
  );
}
