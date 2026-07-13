import React from "react";

interface Props {
  className?: string;
  showWordmark?: boolean;
  size?: number;
}

export function S2SLogo({ className = "", showWordmark = true, size = 28 }: Props) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <defs>
          <linearGradient id="s2s-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="hsl(224 76% 40%)" />
            <stop offset="1" stopColor="hsl(217 91% 55%)" />
          </linearGradient>
        </defs>
        {/* Ear shape */}
        <path
          d="M11 22.5c-2.5-1-4.2-3.5-4.2-6.5C6.8 11.6 10.9 7.6 16 7.6c4.6 0 8.4 3.3 9.1 7.6"
          stroke="url(#s2s-grad)"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <path
          d="M16 13c-1.7 0-3 1.3-3 3 0 1.5.9 2.7 2.2 3"
          stroke="url(#s2s-grad)"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        {/* Sound dot */}
        <circle cx="25" cy="20" r="2.4" fill="url(#s2s-grad)" />
        <circle cx="25" cy="20" r="5.5" stroke="url(#s2s-grad)" strokeWidth="1.4" strokeOpacity="0.4" />
      </svg>
      {showWordmark && (
        <span className="font-display font-extrabold text-primary text-lg tracking-tight">
          S2S
        </span>
      )}
    </div>
  );
}
