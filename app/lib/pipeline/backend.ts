/**
 * Speech-to-Sign pipeline client.
 *
 * Thin fetchers over the stateless backend stages. Each call fails loud on a
 * non-OK response so callers surface the exact stage that broke.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `${path} failed: HTTP ${resp.status}`);
  }
  return resp.json();
}

export async function audioToText(
  wav: Blob,
  opts: { translate?: boolean } = {},
): Promise<string> {
  const form = new FormData();
  form.append("audio", wav, "segment.wav");
  // translate => Whisper outputs English from any spoken language.
  form.append("task", opts.translate ? "translate" : "transcribe");
  const resp = await fetch(`${API_URL}/audio-to-text`, {
    method: "POST",
    body: form,
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `audio-to-text failed: HTTP ${resp.status}`);
  }
  const data = await resp.json();
  return (data.text || "").trim();
}

export async function textToGloss(text: string): Promise<string> {
  const data = await postJson<{ gloss: string }>("/text-to-gloss", { text });
  return data.gloss;
}

export interface SigmlResult {
  sigml: string;
  /** Tokens that render as fingerspelling because no sign asset exists. */
  fingerspelled: string[];
}

export async function glossToSigml(gloss: string): Promise<SigmlResult> {
  const data = await postJson<{ sigml: string; fingerspelled?: string[] }>(
    "/gloss-to-sigml",
    { gloss },
  );
  return { sigml: data.sigml, fingerspelled: data.fingerspelled ?? [] };
}

export interface RecognitionResult {
  sentence: string;
  gloss: string[];
}

/** Send one recorded clip; the backend segments it and classifies each segment
 *  against the WLASL sign vocabulary, returning the recognized signs and the
 *  English sentence the LLM reconstructs from them. */
export async function recognizeVideo(clip: Blob): Promise<RecognitionResult> {
  const form = new FormData();
  form.append("video", clip, "phrase.webm");
  const resp = await fetch(`${API_URL}/video-to-sentence`, { method: "POST", body: form });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `video-to-sentence failed: HTTP ${resp.status}`);
  }
  const data = await resp.json();
  return { sentence: (data.sentence || "").trim(), gloss: Array.isArray(data.gloss) ? data.gloss : [] };
}
