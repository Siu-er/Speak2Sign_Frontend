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

export async function signToSentence(signs: string[]): Promise<string> {
  const data = await postJson<{ sentence: string }>("/sign-to-sentence", { signs });
  return data.sentence;
}

export interface SignSpan {
  sign: string;
  confidence: number;
  /** How many consecutive windows held this sign (run length). */
  count: number;
}

export interface SignSequence {
  signs: string[];
  detail: SignSpan[];
}

/** Send one recorded phrase clip holding several signs back to back; the backend
 *  extracts landmarks with the training-matched Holistic pipeline, slides the
 *  isolated-sign recognizer across the clip, and returns the ordered signs. */
export async function videoToSigns(clip: Blob): Promise<SignSequence> {
  const form = new FormData();
  form.append("video", clip, "phrase.webm");
  const resp = await fetch(`${API_URL}/video-to-signs`, { method: "POST", body: form });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `video-to-signs failed: HTTP ${resp.status}`);
  }
  const data = await resp.json();
  return {
    signs: data.signs ?? [],
    detail: (data.detail ?? []).map(
      (d: { sign: string; confidence: number; count: number }) => ({
        sign: d.sign,
        confidence: d.confidence,
        count: d.count,
      }),
    ),
  };
}
