import React from "react";

// Pieces spread evenly round the circle; distance and size vary in a fixed
// pattern so the burst looks scattered yet renders identically every time.
const PIECES = 18;
const COLOURS = ["--ribbon-red", "--ribbon-blue", "--ribbon-amber", "--ribbon-coral", "--ribbon-violet"];

/** A one-shot burst in the logo's colours, played behind a success message. */
export function Celebration() {
  return (
    <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
      {Array.from({ length: PIECES }, (_, i) => {
        const size = 6 + (i % 3) * 3;
        return (
          <span
            key={i}
            className="s2s-burst-piece"
            style={{
              width: size,
              height: size * 1.8,
              background: `hsl(var(${COLOURS[i % COLOURS.length]}))`,
              ["--r" as string]: `${(360 / PIECES) * i}deg`,
              ["--d" as string]: `${90 + (i % 4) * 28}px`,
              animationDelay: `${(i % 3) * 40}ms`,
            }}
          />
        );
      })}
    </div>
  );
}
