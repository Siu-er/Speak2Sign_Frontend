import React from "react";

type ChipTone = "neutral" | "primary" | "success" | "rose" | "amber" | "blue" | "emerald";

const TONE: Record<ChipTone, string> = {
  neutral: "bg-secondary text-secondary-foreground",
  primary: "bg-primary-soft text-primary",
  success: "bg-emerald-100 text-emerald-700",
  rose: "bg-rose-100 text-rose-700",
  amber: "bg-amber-100 text-amber-700",
  blue: "bg-blue-100 text-blue-700",
  emerald: "bg-emerald-100 text-emerald-700",
};

interface ChipProps {
  tone?: ChipTone;
  size?: "xs" | "sm";
  className?: string;
  children: React.ReactNode;
}

export function Chip({ tone = "neutral", size = "xs", className = "", children }: ChipProps) {
  const sizeCls = size === "xs" ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-xs";
  return (
    <span className={`inline-flex items-center rounded-full font-semibold ${sizeCls} ${TONE[tone]} ${className}`}>
      {children}
    </span>
  );
}
