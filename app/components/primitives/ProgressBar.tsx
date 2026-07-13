import React from "react";

interface Props {
  value: number; // 0..100
  size?: "sm" | "md";
  className?: string;
}

export function ProgressBar({ value, size = "md", className = "" }: Props) {
  const h = size === "sm" ? "h-1.5" : "h-2";
  return (
    <div className={`${h} rounded-full bg-primary-soft overflow-hidden ${className}`}>
      <div
        className="h-full rounded-full bg-gradient-progress transition-all duration-500"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}
