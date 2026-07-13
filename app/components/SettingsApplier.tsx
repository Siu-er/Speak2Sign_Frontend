"use client";

import { useEffect } from "react";
import { useSettings } from "@/app/hooks/useSettings";

/**
 * Applies global accessibility settings to the document: text-size scales the
 * root font, high-contrast toggles a class consumed by globals.css.
 */
export function SettingsApplier() {
  const { settings } = useSettings();

  useEffect(() => {
    const root = document.documentElement;
    // textSize 0..100 -> 90%..130% root font.
    const scale = 90 + (settings.textSize / 100) * 40;
    root.style.fontSize = `${scale}%`;
    root.classList.toggle("s2s-high-contrast", settings.highContrast);
  }, [settings.textSize, settings.highContrast]);

  return null;
}
