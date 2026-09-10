"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { Search, Hand } from "lucide-react";
import { PageShell } from "@/app/components/shell/PageShell";
import { LiveAvatar, AvatarClip } from "@/app/components/live/LiveAvatar";
import { textToGloss, glossToSigml } from "@/app/lib/pipeline/backend";

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

  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const idRef = useRef(0);

  const sign = useCallback((word: string) => {
    const w = word.trim();
    if (!w) return;
    setCurrent({ word: w, gloss: "", spelled: [] });
    queueRef.current = queueRef.current
      .then(async () => {
        const gloss = await textToGloss(w);
        const { sigml, fingerspelled } = await glossToSigml(gloss);
        if (sigml?.trim()) setClips((prev) => [...prev, { id: idRef.current++, sigml }]);
        setCurrent({ word: w, gloss, spelled: fingerspelled.map((s) => s.replace(/^FS-/, "")) });
      })
      .catch(() => { /* keep the page alive */ });
  }, []);

  const words = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) return Object.values(CATEGORIES).flat().filter((w) => w.includes(q));
    return CATEGORIES[cat];
  }, [cat, query]);

  const isFingerspelled = !!current && current.spelled.length > 0 && current.gloss.startsWith("FS-");

  return (
    <PageShell title="Dictionary" eyebrow="Look up any sign" className="gap-3">
      {/* avatar + current word */}
      <div className="rounded-[26px] bg-white/70 border border-white/60 shadow-card p-2.5 flex items-center gap-3">
        <LiveAvatar clips={clips} avw={360} avh={360} className="w-32 h-32 rounded-2xl bg-gradient-to-b from-slate-100 to-slate-200/70 shrink-0" />
        <div className="min-w-0">
          {current ? (
            <>
              <p className="font-display font-extrabold text-2xl text-foreground capitalize leading-tight">{current.word}</p>
              {current.gloss && (
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="font-mono">{current.gloss}</span>
                  {isFingerspelled && <span className="ml-1.5 inline-flex items-center gap-1 text-amber-700"><Hand className="w-3 h-3" /> spelled</span>}
                </p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground/70 italic text-sm">Pick a word to see it signed.</p>
          )}
        </div>
      </div>

      {/* search */}
      <div className="flex items-center gap-2 bg-white/90 rounded-full border border-primary/10 px-4 py-2.5 shadow-pill-soft">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search any word..." className="flex-1 bg-transparent outline-none text-[15px] font-medium min-w-0" />
      </div>

      {/* categories */}
      {!query && (
        <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CATS.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-colors whitespace-nowrap ${c === cat ? "bg-primary text-white shadow-pill-soft" : "bg-white/80 border border-primary/10 text-foreground hover:border-primary/40"}`}>{c}</button>
          ))}
        </div>
      )}

      {/* word grid */}
      <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="grid grid-cols-2 gap-2.5">
          {words.map((w) => (
            <button key={w} onClick={() => sign(w)} className={`px-3 py-3 rounded-2xl text-[15px] font-bold capitalize text-left transition-all shadow-pill-soft ${current?.word === w ? "bg-primary text-white" : "bg-white/85 border border-primary/10 text-foreground hover:border-primary/40 hover:-translate-y-0.5"}`}>{w}</button>
          ))}
          {words.length === 0 && query && (
            <button onClick={() => sign(query)} className="col-span-2 px-3 py-3 rounded-2xl bg-white/85 border border-dashed border-primary/30 text-foreground font-semibold">Sign &ldquo;{query}&rdquo; (fingerspelled)</button>
          )}
        </div>
      </div>
    </PageShell>
  );
}
