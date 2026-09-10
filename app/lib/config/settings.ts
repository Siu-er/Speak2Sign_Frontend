export const VOICE_TONES = ["Natural", "Warm", "Crisp", "Robotic"] as const;
export type VoiceTone = (typeof VOICE_TONES)[number];

// Spoken-input languages. "code" is the BCP-47-ish hint; non-English implies
// the speech pipeline should translate to English before glossing.
export const SUPPORTED_LANGUAGES = [
  { label: "English (US)", code: "en", translate: false },
  { label: "English (AU)", code: "en", translate: false },
  { label: "Japanese", code: "ja", translate: true },
  { label: "Mandarin (Simplified)", code: "zh", translate: true },
  { label: "Spanish", code: "es", translate: true },
] as const;

export type AvatarId = "luna" | "siggi" | "anna" | "marc" | "francoise";
export const AVATARS: AvatarId[] = ["luna", "siggi", "anna", "marc", "francoise"];

export interface AppSettings {
  language: string;
  playbackSpeed: number;
  voiceTone: VoiceTone;
  textSize: number;
  highContrast: boolean;
  haptic: boolean;
  recordingHistory: boolean;
  avatar: AvatarId;
  /** Draw a live hand-landmark skeleton over the signer's camera preview. */
  showLandmarks: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: "English (US)",
  playbackSpeed: 1.2,
  voiceTone: "Natural",
  textSize: 50,
  highContrast: false,
  haptic: false,
  recordingHistory: true,
  avatar: "luna",
  showLandmarks: false,
};

/** Whether the chosen spoken language needs translation to English. */
export function languageNeedsTranslation(label: string): boolean {
  return SUPPORTED_LANGUAGES.find((l) => l.label === label)?.translate ?? false;
}

export const SETTINGS_STORAGE_KEY = "s2s:settings";
