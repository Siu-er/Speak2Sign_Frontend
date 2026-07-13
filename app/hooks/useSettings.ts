"use client";

import { useCallback, useEffect, useState } from "react";
import { AppSettings } from "@/app/lib/config/settings";
import {
  getSettings,
  subscribeSettings,
  updateSettings,
} from "@/app/lib/config/settings-store";

export interface UseSettings {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
}

/** Live settings, shared across the app and persisted to localStorage. */
export function useSettings(): UseSettings {
  const [settings, setSettings] = useState<AppSettings>(getSettings);
  useEffect(() => subscribeSettings(setSettings), []);
  const update = useCallback((patch: Partial<AppSettings>) => updateSettings(patch), []);
  return { settings, update };
}
