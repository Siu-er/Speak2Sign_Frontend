"use client";

import {
  AppSettings,
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
} from "./settings";

// Shared settings singleton so every screen reads and reacts to the same live
// values, persisted to localStorage.
type Listener = (s: AppSettings) => void;

let current: AppSettings = { ...DEFAULT_SETTINGS };
let loaded = false;
const listeners = new Set<Listener>();

function load(): void {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) current = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* keep defaults */
  }
}

export function getSettings(): AppSettings {
  load();
  return current;
}

export function updateSettings(patch: Partial<AppSettings>): void {
  load();
  current = { ...current, ...patch };
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* noop */
  }
  const snap = current;
  listeners.forEach((l) => l(snap));
}

export function subscribeSettings(listener: Listener): () => void {
  load();
  listeners.add(listener);
  listener(current);
  return () => listeners.delete(listener);
}
