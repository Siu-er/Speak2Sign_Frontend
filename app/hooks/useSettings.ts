"use client";

import { useCallback, useSyncExternalStore } from "react";
import { AppSettings, DEFAULT_SETTINGS } from "@/app/lib/config/settings";
import {
  getSettings,
  subscribeSettings,
  updateSettings,
} from "@/app/lib/config/settings-store";

export interface UseSettings {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
}

const subscribe = (onChange: () => void) => subscribeSettings(() => onChange());
// The server has no stored settings; hydration renders the defaults, then
// React moves to the stored values without a markup mismatch.
const serverSnapshot = () => DEFAULT_SETTINGS;

/** Live settings, shared across the app and persisted to localStorage. */
export function useSettings(): UseSettings {
  const settings = useSyncExternalStore(subscribe, getSettings, serverSnapshot);
  const update = useCallback((patch: Partial<AppSettings>) => updateSettings(patch), []);
  return { settings, update };
}
