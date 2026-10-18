"use client";

/** What S2S keeps about the person using this device, stored on the device only. */
export interface UserProfile {
  name: string;
}

export const PROFILE_STORAGE_KEY = "s2s:profile";

export const EMPTY_PROFILE: UserProfile = { name: "" };

type Listener = (p: UserProfile) => void;

let current: UserProfile = { ...EMPTY_PROFILE };
let loaded = false;
const listeners = new Set<Listener>();

function load(): void {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (raw) {
      const stored = JSON.parse(raw);
      current = { name: stored && typeof stored.name === "string" ? stored.name : "" };
    }
  } catch {
    /* unreadable storage: the profile starts empty */
  }
}

export function getProfile(): UserProfile {
  load();
  return current;
}

export function updateProfile(patch: Partial<UserProfile>): void {
  load();
  current = { ...current, ...patch };
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* storage unavailable: the change lasts for this visit */
  }
  const snap = current;
  listeners.forEach((l) => l(snap));
}

export function subscribeProfile(listener: Listener): () => void {
  load();
  listeners.add(listener);
  listener(current);
  return () => listeners.delete(listener);
}

/** Up-to-two-letter monogram from the name; empty when no name is set. */
export function profileInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
