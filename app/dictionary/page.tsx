"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { Search, Hand, TriangleAlert } from "lucide-react";
import { PageShell } from "@/app/components/shell/PageShell";
import { SignAvatar, AvatarClip } from "@/app/components/avatar/SignAvatar";
import { textToSign } from "@/app/lib/pipeline/backend";

const CATEGORIES: Record<string, string[]> = {
  Greetings: ["hello", "thank you", "please", "sorry", "goodbye", "welcome", "yes", "no"],
  People: ["family", "friend", "mother", "father", "sister", "brother", "teacher", "student", "baby", "name"],
  Actions: ["eat", "drink", "go", "come", "help", "learn", "work", "play", "read", "write", "want", "need", "know"],
  Feelings: ["happy", "sad", "love", "tired", "hungry", "angry", "good", "bad", "fine"],
  Time: ["today", "tomorrow", "yesterday", "now", "morning", "night", "week", "year"],
  Places: ["home", "school", "hospital", "store", "work", "bathroom"],
};
const CATS = Object.keys(CATEGORIES);

export default function DictionaryPage() {
  const [cat, setCat] = useState(CATS[0]);
  const [query, setQuery] = useState("");
  const [clips, setClips] = useState<AvatarClip[]>([]);
  const [current, setCurrent] = useState<{ word: string; gloss: string; spelled: string[] } | null>(null);
  const [error, setError] = useState("");

  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const idRef = useRef(0);

  const sign = useCallback((word: string) => {
    const w = word.trim();
    if (!w) return;
    setCurrent({ word: w, gloss: "", spelled: [] });
    setError("");
    queueRef.current = queueRef.current
      .then(async () => {
        const { gloss, sigml, nonManual, fingerspelled } = await textToSign(w);
        if (!sigml.trim()) throw new Error(`No sign was produced for "${w}".`);
        setClips((prev) => [...prev, { id: idRef.current++, sigml, nonManual }]);
        setCurrent({ word: w, gloss, spelled: fingerspelled.map((s) => s.replace(/^FS-/, "")) });
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const words = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) return Object.values(CATEGORIES).flat().filter((w) => w.includes(q));
    return CATEGORIES[cat];
  }, [cat, query]);

  const isFingerspelled = !!current && current.spelled.length > 0 && current.gloss.startsWith("FS-");

  return (
    <PageShell title="Dictionary" subtitle="Look up any sign" className="gap-3">
      {/* avatar + current word */}
      <div className="s2s-card p-2.5 flex items-center gap-4">
        <SignAvatar clips={clips} variant="thumb" className="w-36 h-44 shrink-0" />
        <div className="min-w-0 pr-2">
          {current ? (
            <>
              <p className="font-display font-extrabold text-2xl text-foreground capitalize leading-tight">{current.word}</p>
              {current.gloss && (
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="font-semibold tracking-wide">{current.gloss}</span>
                  {isFingerspelled && <span className="ml-1.5 inline-flex items-center gap-1 text-amber-700"><Hand className="w-3 h-3" /> fingerspelled</span>}
                </p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground text-sm leading-snug">Tap a word to see it signed.</p>
          )}
          {error && (
            <p className="mt-2 flex items-start gap-1.5 text-[12px] font-semibold text-destructive"><TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-px" /> {error}</p>
          )}
        </div>
      </div>

      {/* search */}
      <div className="flex items-center gap-2 s2s-card rounded-full px-4 py-2.5">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a word" aria-label="Search a word" className="flex-1 bg-transparent outline-none text-[15px] font-medium min-w-0" />
      </div>

      {/* categories */}
      {!query && (
        <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CATS.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-colors whitespace-nowrap s2s-press ${c === cat ? "bg-gradient-primary text-white shadow-pill-soft" : "s2s-card text-foreground hover:text-primary"}`}>{c}</button>
          ))}
        </div>
      )}

      {/* word grid */}
      <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="grid grid-cols-2 gap-2.5">
          {words.map((w) => (
            <button key={w} onClick={() => sign(w)} className={`px-4 py-3.5 rounded-[18px] text-[15px] font-bold capitalize text-left s2s-press ${current?.word === w ? "bg-gradient-primary text-white shadow-pill" : "s2s-card text-foreground hover:text-primary"}`}>{w}</button>
          ))}
          {words.length === 0 && query && (
            <button onClick={() => sign(query)} className="col-span-2 px-3 py-3 rounded-[18px] s2s-card border-dashed text-foreground font-semibold s2s-press">Fingerspell &ldquo;{query}&rdquo;</button>
          )}
        </div>
      </div>
    </PageShell>
  );
}
