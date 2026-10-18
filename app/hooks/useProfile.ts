"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  EMPTY_PROFILE,
  getProfile,
  subscribeProfile,
  updateProfile,
  UserProfile,
} from "@/app/lib/config/profile-store";

export interface UseProfile {
  profile: UserProfile;
  update: (patch: Partial<UserProfile>) => void;
}

const subscribe = (onChange: () => void) => subscribeProfile(() => onChange());
// The server has no stored profile; hydration renders it empty, then React
// moves to the stored profile without a markup mismatch.
const serverSnapshot = () => EMPTY_PROFILE;

/** Live local profile, persisted to localStorage. */
export function useProfile(): UseProfile {
  const profile = useSyncExternalStore(subscribe, getProfile, serverSnapshot);
  const update = useCallback((patch: Partial<UserProfile>) => updateProfile(patch), []);
  return { profile, update };
}
