"use client";

import React from "react";
import { Mic, MicOff } from "lucide-react";
import { useMicLevel } from "@/app/hooks/useMicLevel";

interface Props {
  listening: boolean;
  onToggle: () => void;
  size?: number;
  disabled?: boolean;
}

/**
 * Microphone control whose rings swell with the speaker's voice while
 * listening, so the person speaking sees that they are heard.
 */
export function MicButton({ listening, onToggle, size = 56, disabled = false }: Props) {
  const { level, error } = useMicLevel(listening);
  const rings = [1.25, 1.55, 1.9];

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={listening}
      aria-label={listening ? "Stop listening" : "Start listening"}
      title={error ? `Voice level unavailable: ${error}` : undefined}
      className="relative shrink-0 grid place-items-center rounded-full s2s-press disabled:opacity-50"
      style={{ width: size, height: size }}
    >
      {listening &&
        rings.map((r, i) => (
          <span
            key={r}
            aria-hidden="true"
            className="absolute inset-0 rounded-full"
            style={{
              background: "var(--gradient-ribbon)",
              opacity: Math.max(0, 0.32 - i * 0.09) * (0.35 + level),
              transform: `scale(${1 + (r - 1) * (0.25 + level)})`,
              transition: "transform 90ms linear, opacity 90ms linear",
            }}
          />
        ))}
      <span
        className={`relative grid place-items-center rounded-full w-full h-full text-white transition-colors ${
          listening ? "bg-recording shadow-pill" : "bg-gradient-primary shadow-pill"
        }`}
      >
        {listening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
      </span>
    </button>
  );
}
