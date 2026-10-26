"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { Search, Hand, TriangleAlert, MapPin, MoveRight, Play } from "lucide-react";
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

// Popular signs written out, so a sign can be learnt by reading as well as by watching.
// Each describes the standard ASL form with the dominant hand.
const STEP_SIGNS: { word: string; hand: string; place: string; move: string }[] = [
  { word: "hello", hand: "Flat hand, fingers together.", place: "Fingertips beside your forehead, palm facing out.", move: "Move it out and away, like a small salute." },
  { word: "thank you", hand: "Flat hand, fingers together.", place: "Fingertips touching your chin.", move: "Bring the hand forward and down, towards the person." },
  { word: "please", hand: "Flat hand, palm on your body.", place: "The middle of your chest.", move: "Rub a circle on your chest." },
  { word: "sorry", hand: "Closed fist, thumb resting on the side.", place: "The middle of your chest.", move: "Rub a circle on your chest." },
  { word: "yes", hand: "Closed fist.", place: "In front of your shoulder.", move: "Bend the wrist up and down, like a nodding head." },
  { word: "help", hand: "Thumbs-up fist resting on your other, flat palm.", place: "In front of your chest.", move: "Lift both hands up together." },
  { word: "friend", hand: "Both index fingers hooked.", place: "In front of your chest.", move: "Hook them together, swap which is on top, and hook again." },
  { word: "name", hand: "Both hands: index and middle fingers out, together.", place: "In front of your chest, one hand above the other.", move: "Tap the top fingers across the lower ones twice." },
];
const STEP_PARTS = [
  { key: "hand", label: "Hand shape", Icon: Hand },
  { key: "place", label: "Where", Icon: MapPin },
  { key: "move", label: "Movement", Icon: MoveRight },
] as const;
const STEP_TAB = "Step by step";
const CATS = [STEP_TAB, ...Object.keys(CATEGORIES)];

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
    return CATEGORIES[cat] ?? [];
  }, [cat, query]);

  const isFingerspelled = !!current && current.spelled.length > 0 && current.gloss.startsWith("FS-");

  return (
    <PageShell title="Dictionary" subtitle="Look up any sign" className="gap-3">
      {/* Desktop: the signer stays in view on the left while the word list scrolls on the right. */}
      <div className="flex-1 flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)] lg:gap-8 lg:items-start">
      <div className="s2s-card p-2.5 flex items-center gap-4 lg:sticky lg:top-6 lg:flex-col lg:items-stretch lg:gap-0 lg:p-3 lg:rounded-[30px]">
        <SignAvatar clips={clips} variant="thumb" className="w-36 h-44 shrink-0 lg:w-full lg:h-[min(520px,calc(100vh-260px))] lg:rounded-[22px]" />
        <div className="min-w-0 pr-2 lg:px-3 lg:pt-4 lg:pb-2 lg:min-h-[96px]">
          {current ? (
            <>
              <p className="font-display font-extrabold text-2xl text-foreground capitalize leading-tight lg:text-[34px]">{current.word}</p>
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

      <div className="flex flex-col gap-3 lg:gap-4 min-h-0 flex-1">
      {/* search */}
      <div data-guide="dictionary-search" className="flex items-center gap-2 s2s-card rounded-full px-4 py-2.5 lg:py-3.5 lg:px-5">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a word" aria-label="Search a word" className="flex-1 bg-transparent outline-none text-[15px] font-medium min-w-0" />
      </div>

      {/* categories */}
      {!query && (
        <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-0.5 lg:flex-wrap lg:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CATS.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-colors whitespace-nowrap s2s-press ${c === cat ? "bg-gradient-primary text-white shadow-pill-soft" : "s2s-card text-foreground hover:text-primary"}`}>{c}</button>
          ))}
        </div>
      )}

      {/* popular signs, written out step by step */}
      {!query && cat === STEP_TAB && (
        <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
          {STEP_SIGNS.map((s, k) => {
            const on = current?.word === s.word;
            return (
              <article
                key={s.word}
                className={`relative overflow-hidden rounded-[24px] p-4 s2s-card animate-fade-up transition-shadow duration-300 lg:p-5 ${on ? "bg-white ring-2 ring-primary/30 shadow-pill-soft" : ""}`}
                style={{ animationDelay: `${k * 45}ms` }}
              >
                <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 s2s-ribbon transition-opacity duration-300 ${on ? "opacity-100" : "opacity-0"}`} />
                <header className="flex items-center justify-between gap-3">
                  <h3 className="font-display font-extrabold text-[22px] leading-tight capitalize text-foreground lg:text-[25px]">{s.word}</h3>
                  <button
                    onClick={() => sign(s.word)}
                    className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-bold s2s-press lg:text-[13px] ${on ? "bg-gradient-primary text-white shadow-pill-soft" : "bg-primary-soft text-primary"}`}
                  >
                    <Play className="w-3.5 h-3.5" /> Watch Vy
                  </button>
                </header>
                <ol className="mt-3.5 space-y-3">
                  {STEP_PARTS.map(({ key, label, Icon }, i) => (
                    <li key={key} className="flex gap-3">
                      <span className="relative grid place-items-center w-9 h-9 shrink-0 rounded-full bg-primary-soft text-primary">
                        <Icon className="w-4 h-4" />
                        <span className="absolute -top-1 -right-1 grid place-items-center w-4 h-4 rounded-full bg-primary text-white text-[10px] font-extrabold">{i + 1}</span>
                      </span>
                      <p className="min-w-0 text-[14px] leading-snug text-foreground lg:text-[15px]">
                        <span className="block text-[11px] font-bold text-muted-foreground lg:text-[12px]">{label}</span>
                        {s[key]}
                      </p>
                    </li>
                  ))}
                </ol>
              </article>
            );
          })}
        </div>
      )}

      {/* word grid */}
      <div className={`flex-1 min-h-0 overflow-y-auto -mx-1 px-1 lg:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${!query && cat === STEP_TAB ? "hidden" : ""}`}>
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3 lg:gap-3.5">
          {words.map((w) => (
            <button key={w} onClick={() => sign(w)} className={`px-4 py-3.5 lg:py-5 lg:text-[16px] rounded-[18px] text-[15px] font-bold capitalize text-left s2s-press ${current?.word === w ? "bg-gradient-primary text-white shadow-pill" : "s2s-card text-foreground hover:text-primary"}`}>{w}</button>
          ))}
          {words.length === 0 && query && (
            <button onClick={() => sign(query)} className="col-span-2 lg:col-span-3 px-3 py-3 rounded-[18px] s2s-card border-dashed text-foreground font-semibold s2s-press">Fingerspell &ldquo;{query}&rdquo;</button>
          )}
        </div>
      </div>
      </div>
      </div>
    </PageShell>
  );
}
