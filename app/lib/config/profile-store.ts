"use client";

export interface UserProfile {
  name: string;
  email: string;
  phone: string;
}

export const PROFILE_STORAGE_KEY = "s2s:profile";

export const EMPTY_PROFILE: UserProfile = {
  name: "",
  email: "",
  phone: "",
};

type Listener = (p: UserProfile) => void;

let current: UserProfile = { ...EMPTY_PROFILE };
let loaded = false;
const listeners = new Set<Listener>();

function load(): void {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (raw) current = { ...EMPTY_PROFILE, ...JSON.parse(raw) };
  } catch {
    /* keep empty */
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
    /* noop */
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

/** Up-to-two-letter monogram from the name, or a neutral placeholder. */
export function profileInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "S2";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
