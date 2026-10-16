import React from "react";
import Image from "next/image";

interface Props {
  className?: string;
  height?: number;
}

const LOGO_ASPECT = 480 / 267;

export function S2SLogo({ className = "", height = 32 }: Props) {
  return (
    <Image
      src="/logo.png"
      alt="S2S"
      width={Math.round(height * LOGO_ASPECT)}
      height={height}
      priority
      className={className}
    />
  );
}
