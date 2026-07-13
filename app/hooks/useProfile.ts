"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getProfile,
  subscribeProfile,
  updateProfile,
  UserProfile,
} from "@/app/lib/config/profile-store";

export interface UseProfile {
  profile: UserProfile;
  update: (patch: Partial<UserProfile>) => void;
}

/** Live local profile, persisted to localStorage. */
export function useProfile(): UseProfile {
  const [profile, setProfile] = useState<UserProfile>(getProfile);
  useEffect(() => subscribeProfile(setProfile), []);
  const update = useCallback((patch: Partial<UserProfile>) => updateProfile(patch), []);
  return { profile, update };
}
