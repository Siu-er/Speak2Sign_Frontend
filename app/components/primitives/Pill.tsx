"use client";

import React from "react";

type PillVariant = "primary" | "soft" | "destructive" | "ghost";
type PillSize = "sm" | "md" | "lg";

interface PillProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  variant?: PillVariant;
  size?: PillSize;
  asChild?: boolean;
  fullWidth?: boolean;
  type?: "button" | "submit" | "reset";
}

const VARIANT: Record<PillVariant, string> = {
  primary: "bg-gradient-primary text-primary-foreground shadow-pill",
  soft: "bg-primary-soft text-primary shadow-pill-soft",
  destructive: "bg-gradient-stop text-primary-foreground shadow-pill",
  ghost: "bg-transparent text-primary hover:bg-primary-soft/60",
};

const SIZE: Record<PillSize, string> = {
  sm: "h-10 px-4 text-sm",
  md: "h-12 px-5 text-sm",
  lg: "h-14 px-6 text-base",
};

export function Pill({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
  type = "button",
  children,
  ...rest
}: PillProps) {
  return (
    <button
      type={type}
      className={[
        "rounded-full font-bold inline-flex items-center justify-center gap-2",
        "transition-transform active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none",
        VARIANT[variant],
        SIZE[size],
        fullWidth ? "w-full" : "",
        className,
      ].join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}
