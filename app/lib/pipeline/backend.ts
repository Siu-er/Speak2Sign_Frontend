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

/** Translate an utterance recognized in another language into English, which is
 *  what the gloss stage accepts. */
export async function translateToEnglish(text: string): Promise<string> {
  const data = await postJson<{ text: string }>("/translate-to-english", { text });
  return data.text.trim();
}

/** Sentence-level non-manual grammar the glosser derives: brows raise for a
 *  yes/no question, furrow for a WH question; the head shakes for negation. */
export interface NonManual {
  brows: "raise" | "furrow" | null;
  head: "shake" | null;
}

export interface GlossResult {
  gloss: string;
  nonManual: NonManual;
}

export async function textToGloss(text: string): Promise<GlossResult> {
  const data = await postJson<{ gloss: string; non_manual_markers: NonManual }>("/text-to-gloss", { text });
  return { gloss: data.gloss, nonManual: { brows: data.non_manual_markers.brows, head: data.non_manual_markers.head } };
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

export interface SignResult extends SigmlResult, GlossResult {}

/** English text to everything the avatar needs: the SiGML to sign and the
 *  sentence's non-manual grammar. */
export async function textToSign(text: string): Promise<SignResult> {
  const glossed = await textToGloss(text);
  const signed = await glossToSigml(glossed.gloss);
  return { ...glossed, ...signed };
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
