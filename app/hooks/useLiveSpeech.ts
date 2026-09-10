"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Options {
  onFinal: (text: string) => void;
  lang?: string;
}

/**
 * Continuous browser speech recognition (Web Speech API). Emits interim text
 * for a live caption and calls onFinal for each completed phrase. Recognition
 * runs entirely in the browser, so captions appear with no network round-trip.
 */
export function useLiveSpeech({ onFinal, lang = "en-US" }: Options) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [supported, setSupported] = useState(true);
  const recRef = useRef<any>(null);
  const wantOnRef = useRef(false);
  const onFinalRef = useRef(onFinal);
  useEffect(() => { onFinalRef.current = onFinal; }, [onFinal]);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;
    rec.onresult = (e: any) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          const t = r[0].transcript.trim();
          if (t) onFinalRef.current(t);
        } else {
          interimText += r[0].transcript;
        }
      }
      setInterim(interimText);
    };
    rec.onend = () => {
      // Chrome stops recognition periodically; restart while the user wants it on.
      if (wantOnRef.current) { try { rec.start(); } catch { /* already starting */ } }
      else setListening(false);
    };
    rec.onerror = () => { /* transient; onend handles restart */ };
    recRef.current = rec;
    return () => { wantOnRef.current = false; try { rec.stop(); } catch { /* not started */ } };
  }, [lang]);

  const start = useCallback(() => {
    if (!recRef.current) return;
    wantOnRef.current = true;
    try { recRef.current.start(); setListening(true); } catch { /* already running */ }
  }, []);

  const stop = useCallback(() => {
    wantOnRef.current = false;
    setInterim("");
    try { recRef.current?.stop(); } catch { /* not started */ }
    setListening(false);
  }, []);

  return { listening, interim, supported, start, stop };
}
