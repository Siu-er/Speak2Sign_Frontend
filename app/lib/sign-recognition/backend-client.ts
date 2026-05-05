/**
 * Backend client for the sign recognition API.
 */

import { frameToJson } from "./landmark-extractor";
import { InferenceResult } from "./recognition-engine";
import { NUM_SIGN_CLASSES } from "./constants";

const DEFAULT_API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

let cachedLabelMap: Map<number, string> | null = null;

export async function fetchLabelMap(apiUrl: string = DEFAULT_API_URL): Promise<Map<number, string>> {
  if (cachedLabelMap) return cachedLabelMap;
  const resp = await fetch(`${apiUrl}/sign-labels`);
  if (!resp.ok) throw new Error(`Label fetch failed: HTTP ${resp.status}`);
  const data = await resp.json();
  const map = new Map<number, string>();
  for (const [k, v] of Object.entries<string>(data.labels)) {
    map.set(Number(k), v);
  }
  cachedLabelMap = map;
  return map;
}

export async function recognizeSign(
  frames: Float32Array[],
  labelMap: Map<number, string>,
  opts: { apiUrl?: string; returnAllProbs?: boolean } = {},
): Promise<InferenceResult> {
  const apiUrl = opts.apiUrl ?? DEFAULT_API_URL;
  const returnAllProbs = opts.returnAllProbs ?? true;

  const landmarks = frames.map(frameToJson);
  const resp = await fetch(`${apiUrl}/sign-to-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ landmarks, return_all_probs: returnAllProbs }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${resp.status}`);
  }
  const data = await resp.json();

  const topK = (data.top_5 || []).map((p: any) => ({
    sign: p.sign,
    classIndex: p.class_index ?? -1,
    confidence: p.confidence,
  }));

  let allProbs: Float32Array;
  if (data.all_probs) {
    allProbs = Float32Array.from(data.all_probs);
  } else {
    // Fallback: synthesize from top_5 (lossy)
    allProbs = new Float32Array(NUM_SIGN_CLASSES);
    for (const p of topK) {
      if (p.classIndex >= 0) allProbs[p.classIndex] = p.confidence;
    }
  }

  return { topK, allProbs };
}
