"use client";

import React from "react";

interface Props {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  ariaLabel?: string;
}

export function Slider({ value, min, max, step = 1, onChange, ariaLabel }: Props) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="relative h-7 flex items-center">
      <div className="absolute inset-x-0 h-1.5 rounded-full bg-primary-soft" />
      <div
        className="absolute h-1.5 rounded-full bg-primary"
        style={{ width: `${pct}%` }}
      />
      <span
        className="absolute w-5 h-5 -ml-2.5 rounded-full bg-primary shadow-pill-soft"
        style={{ left: `${pct}%` }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        aria-label={ariaLabel}
        className="absolute inset-0 opacity-0 cursor-pointer"
      />
    </div>
  );
}
