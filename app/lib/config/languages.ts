/** Spoken languages the Live Sign page offers for recognition.
 *
 * Tags are BCP-47 and go straight to the Web Speech API, which performs the
 * recognition. Anything other than the default is translated to English before
 * glossing, because the gloss stage is English-only.
 */
export interface SpeechLanguage {
  tag: string;
  label: string;
}

export const DEFAULT_SPEECH_LANG = "en-US";

export const SPEECH_LANGUAGES: readonly SpeechLanguage[] = [
  { tag: DEFAULT_SPEECH_LANG, label: "English" },
  { tag: "vi-VN", label: "Vietnamese" },
  { tag: "zh-CN", label: "Chinese" },
  { tag: "ja-JP", label: "Japanese" },
  { tag: "ko-KR", label: "Korean" },
  { tag: "es-ES", label: "Spanish" },
  { tag: "fr-FR", label: "French" },
  { tag: "de-DE", label: "German" },
  { tag: "hi-IN", label: "Hindi" },
  { tag: "ar-SA", label: "Arabic" },
];
