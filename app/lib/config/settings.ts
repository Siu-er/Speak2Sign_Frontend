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

/** Signing characters; each id names /avatars/<id>.vrm and its portrait /avatars/<id>.png. */
export const AVATARS = [
  { id: "vy", label: "Vy" },
  { id: "vy-hoodie", label: "Vy (hoodie)" },
  { id: "huy", label: "Huy" },
  { id: "shino", label: "Shino" },
  { id: "shibu", label: "Shibu" },
  { id: "fumiriya", label: "Fumiriya" },
] as const;
export type AvatarId = (typeof AVATARS)[number]["id"];

export function isAvatarId(value: unknown): value is AvatarId {
  return AVATARS.some((a) => a.id === value);
}

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
  /** The team's device key, which lifts the API's request limits; empty on a visitor's device. */
  deviceKey: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: "English (US)",
  playbackSpeed: 1.2,
  voiceTone: "Natural",
  textSize: 50,
  highContrast: false,
  haptic: false,
  recordingHistory: true,
  avatar: "vy",
  showLandmarks: false,
  deviceKey: "",
};

/** Whether the chosen spoken language needs translation to English. */
export function languageNeedsTranslation(label: string): boolean {
  return SUPPORTED_LANGUAGES.find((l) => l.label === label)?.translate ?? false;
}

export const SETTINGS_STORAGE_KEY = "s2s:settings";

/**
 * Settings read back from storage, keeping only stored values that are still
 * valid; any other field takes its default. Storage outlives releases, so a
 * value such as a removed avatar must not reach the app.
 */
export function sanitizeSettings(stored: unknown): AppSettings {
  const s = (stored && typeof stored === "object" ? stored : {}) as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
  const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
  return {
    language: SUPPORTED_LANGUAGES.some((l) => l.label === s.language) ? (s.language as string) : d.language,
    playbackSpeed: num(s.playbackSpeed, d.playbackSpeed),
    voiceTone: VOICE_TONES.includes(s.voiceTone as VoiceTone) ? (s.voiceTone as VoiceTone) : d.voiceTone,
    textSize: num(s.textSize, d.textSize),
    highContrast: bool(s.highContrast, d.highContrast),
    haptic: bool(s.haptic, d.haptic),
    recordingHistory: bool(s.recordingHistory, d.recordingHistory),
    avatar: isAvatarId(s.avatar) ? s.avatar : d.avatar,
    showLandmarks: bool(s.showLandmarks, d.showLandmarks),
    deviceKey: typeof s.deviceKey === "string" ? s.deviceKey.trim() : d.deviceKey,
  };
}
