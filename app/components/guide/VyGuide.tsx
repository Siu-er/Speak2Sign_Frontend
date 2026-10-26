"use client";

import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, X } from "lucide-react";

/** Gestures a step can ask for; "point" is resolved to a direction from the target's position. */
type Gesture = "point" | "peace" | "waveBothHands" | "pointPresent" | "celebrate" | "jumpJoyful";
/** How she travels to a step; each is a looping clip in the guide layer. */
type Gait = "walk" | "walkHappy" | "walkCatwalk" | "strut" | "sneak" | "run" | "runHappy" | "jog" | "slideWalk" | "walkBackward";

interface TourStep {
  path: string;
  /** Value of the data-guide attribute on the element the step is about. */
  target: string;
  gait: Gait;
  gesture: Gesture;
  say: string;
  /** data-guide of a control she presses once she has pointed at it, showing the feature working. */
  tap?: string;
}

const TOUR: TourStep[] = [
  { path: "/", target: "home-hero", gait: "run", gesture: "waveBothHands", say: "Hi, I'm Vy! I live in here. Let me show you around." },
  { path: "/", target: "home-live", gait: "walk", gesture: "point", say: "Say or type anything here, and I sign it for you, live." },
  { path: "/", target: "home-roles", gait: "walkHappy", gesture: "point", say: "Talking with someone? Pick a side. You speak or you sign, and I translate both ways." },
  { path: "/", target: "home-explore", gait: "sneak", gesture: "pointPresent", say: "Everything else lives down here: the dictionary, practice and the call companion." },
  { path: "/live", target: "live-phrases", gait: "jog", gesture: "point", tap: "live-first-phrase", say: "Watch this. I tap a phrase, and the signer on the stage signs it, face and all." },
  { path: "/dictionary", target: "dictionary-search", gait: "slideWalk", gesture: "point", say: "Forgot a sign? Search for it, or read the popular ones step by step, and I'll show you how it goes." },
  { path: "/settings", target: "settings-signer", gait: "walkCatwalk", gesture: "peace", say: "You can pick a different signer here. I'll pretend not to be hurt." },
  { path: "/", target: "home-hero", gait: "runHappy", gesture: "jumpJoyful", say: "That's the tour! Now go and say something." },
];

const GUIDE_MODEL = "vy";
// The character's on-screen height: a fraction of the viewport, capped so she
// never dominates a large monitor.
const HEIGHT_OF_VIEWPORT = 0.4;
const MAX_HEIGHT_PX = 340;
// Body proportions of the model, in body heights: half the width she occupies
// beside a target, and the height of her pointing hand above her feet.
const HALF_WIDTH = 0.24;
const HAND_HEIGHT = 0.78;
const EDGE_GAP_PX = 8;
const TARGET_WAIT_MS = 6000;
const SCROLL_SETTLE_MS = 450;
const GLANCE_MS = 1600;
// Auto mode holds each line for a reading time: a base plus a pace per word,
// longer where she has pressed something so its result can be watched.
const READ_BASE_MS = 2200;
const READ_PER_WORD_MS = 320;
const TAP_WATCH_MS = 6000;
// Off screen between rounds of the auto tour.
const ROUND_PAUSE_MS = 4000;

type Mode = "guided" | "auto";

interface GuideApi {
  start: (mode?: Mode) => void;
  running: boolean;
}

const readTime = (step: TourStep) =>
  READ_BASE_MS + READ_PER_WORD_MS * step.say.split(/\s+/).length + (step.tap ? TAP_WATCH_MS : 0);

const GuideContext = createContext<GuideApi | null>(null);

export function useGuide(): GuideApi {
  const api = useContext(GuideContext);
  if (!api) throw new Error("useGuide must be used inside <VyGuideProvider>");
  return api;
}

interface Bubble {
  text: string;
  /** Screen x of the character's centre, y of the top of her head and y of her feet. */
  x: number;
  y: number;
  feet: number;
  halfWidth: number;
  /** The side of the character that faces away from the target. */
  freeSide: "left" | "right";
  last: boolean;
  /** Position of the stop in the tour, for the progress dots. */
  index: number;
  total: number;
  /** In auto mode, how long the line stays before she moves on. */
  holdMs: number | null;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function findTarget(name: string): Promise<HTMLElement> {
  const started = performance.now();
  return new Promise((resolve, reject) => {
    const look = () => {
      const el = document.querySelector<HTMLElement>(`[data-guide="${name}"]`);
      if (el && el.getBoundingClientRect().width > 0) return resolve(el);
      if (performance.now() - started > TARGET_WAIT_MS) return reject(new Error(`The tour could not find "${name}" on this page.`));
      requestAnimationFrame(look);
    };
    look();
  });
}

/**
 * Hosts Vy, the app's guide character, in a click-through layer over every
 * page, and runs the tour: she walks to each feature, points at it and says
 * what it does.
 */
export function VyGuideProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<Mode>("guided");
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [spot, setSpot] = useState<DOMRect | null>(null);
  const [error, setError] = useState("");
  const frameRef = useRef<HTMLIFrameElement>(null);
  const waiters = useRef(new Map<string, () => void>());
  const advance = useRef<(() => void) | null>(null);
  const cancelled = useRef(false);

  const send = useCallback((msg: object) => {
    const win = frameRef.current?.contentWindow;
    if (!win) throw new Error("The guide layer is not loaded");
    win.postMessage(msg, window.location.origin);
  }, []);

  const once = useCallback((type: string) => new Promise<void>((resolve) => waiters.current.set(type, resolve)), []);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frameRef.current?.contentWindow) return;
      if (e.data?.type === "vy-error") { setError(e.data.message); return; }
      const resolve = waiters.current.get(e.data?.type);
      if (resolve) {
        waiters.current.delete(e.data.type);
        resolve();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const stop = useCallback(() => {
    cancelled.current = true;
    advance.current?.();
    setRunning(false);
    setBubble(null);
    setSpot(null);
    setError("");
  }, []);

  useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") stop(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, stop]);

  // The auto tour runs until someone uses the screen, which hands it back to them.
  useEffect(() => {
    if (!running || mode !== "auto") return;
    const handBack = () => stop();
    const events = ["pointerdown", "keydown", "wheel"] as const;
    events.forEach((t) => window.addEventListener(t, handBack, { capture: true }));
    // A touch on an embedded frame (the signing stage) reaches that frame, not this
    // page; the page sees it only as losing focus.
    window.addEventListener("blur", handBack);
    return () => {
      events.forEach((t) => window.removeEventListener(t, handBack, { capture: true }));
      window.removeEventListener("blur", handBack);
    };
  }, [running, mode, stop]);

  const run = useCallback(async (auto: boolean) => {
    const ready = once("vy-ready");
    setRunning(true);
    await ready;
    const W = window.innerWidth, H = window.innerHeight;
    const height = Math.min(H * HEIGHT_OF_VIEWPORT, MAX_HEIGHT_PX);
    const half = height * HALF_WIDTH;
    send({ type: "vy-config", height });

    do {
      send({ type: "vy-place", x: W + half * 2, y: H - EDGE_GAP_PX });

      for (let i = 0; i < TOUR.length; i++) {
        if (cancelled.current) return;
        const step = TOUR[i];
        setBubble(null);
        if (pathRef.current !== step.path) router.push(step.path);
        let el: HTMLElement;
        try {
          el = await findTarget(step.target);
        } catch (e) {
          setError((e as Error).message);
          return;
        }
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        await wait(SCROLL_SETTLE_MS);
        if (cancelled.current) return;
        const r = el.getBoundingClientRect();
        setSpot(r);

        // Stand beside the target where there is room, otherwise below it at the edge.
        const roomRight = W - r.right, roomLeft = r.left;
        let x: number;
        let pointsRight: boolean;
        if (roomRight >= half * 2 + EDGE_GAP_PX) { x = r.right + half; pointsRight = false; }
        else if (roomLeft >= half * 2 + EDGE_GAP_PX) { x = r.left - half; pointsRight = true; }
        else { x = W - half - EDGE_GAP_PX; pointsRight = false; }
        const feet = Math.min(Math.max(r.top + r.height / 2 + HAND_HEIGHT * height, height + EDGE_GAP_PX), H - EDGE_GAP_PX);

        const arrived = once("vy-arrived");
        send({ type: "vy-walk", x, y: feet, gait: step.gait });
        await arrived;
        if (cancelled.current) return;

        let clip: string = step.gesture;
        if (step.gesture === "point") {
          const hand = feet - HAND_HEIGHT * height;
          // She faces the viewer: her left arm points to the screen's right.
          clip = hand > r.bottom ? "pointUp" : pointsRight ? "pointLeft" : "pointRight";
        }
        send({ type: "vy-play", clip });
        // She glances at the feature while presenting it, then back at the reader as she explains.
        send({ type: "vy-look", x: r.left + r.width / 2, y: r.top + r.height / 2 });
        const glance = setTimeout(() => { if (!cancelled.current) send({ type: "vy-look", viewer: true }); }, GLANCE_MS);
        const holdMs = auto ? readTime(step) : null;
        setBubble({ text: step.say, x, y: feet - height, feet, halfWidth: half, freeSide: pointsRight ? "left" : "right", last: i === TOUR.length - 1, index: i, total: TOUR.length, holdMs });
        const pressed = step.tap
          ? setTimeout(() => { if (!cancelled.current) findTarget(step.tap!).then((b) => b.click()).catch((e: Error) => setError(e.message)); }, GLANCE_MS)
          : undefined;
        await new Promise<void>((resolve) => {
          advance.current = resolve;
          if (holdMs !== null) setTimeout(resolve, holdMs);
        });
        clearTimeout(glance);
        clearTimeout(pressed);
        advance.current = null;
      }
      if (cancelled.current) return;
      // She leaves the way she came in: running off the right edge.
      setBubble(null);
      setSpot(null);
      const left = once("vy-arrived");
      send({ type: "vy-walk", x: W + half * 3, y: H - EDGE_GAP_PX, gait: "run" });
      await left;
      if (auto) await wait(ROUND_PAUSE_MS);
    } while (auto && !cancelled.current);
    stop();
  }, [once, router, send, stop]);

  const start = useCallback((next: Mode = "guided") => {
    if (running) return;
    cancelled.current = false;
    setMode(next);
    run(next === "auto").catch((e: Error) => setError(e.message));
  }, [run, running]);

  // A link can start the auto tour on arrival (?tour=auto), for a screen left to run on its own.
  const linked = useRef(false);
  useEffect(() => {
    if (linked.current) return;
    linked.current = true;
    if (new URLSearchParams(window.location.search).get("tour") === "auto") start("auto");
  }, [start]);

  return (
    <GuideContext.Provider value={{ start, running }}>
      {children}
      {running && (
        <>
          {spot && (
            <div
              aria-hidden="true"
              className="fixed z-[59] pointer-events-none rounded-[30px] transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-[0_0_0_9999px_rgba(20,16,40,0.22)]"
              style={{ left: spot.left - 10, top: spot.top - 10, width: spot.width + 20, height: spot.height + 20 }}
            >
              <span className="absolute inset-0 rounded-[30px] p-[3px] s2s-ribbon animate-ribbon-flow [mask:linear-gradient(#000_0_0)_content-box_exclude,linear-gradient(#000_0_0)]" />
              <span className="absolute -inset-1 rounded-[34px] border-2 border-primary/50 animate-guide-pulse" />
            </div>
          )}
          <iframe
            ref={frameRef}
            src={`/vy/guide.html?model=${GUIDE_MODEL}`}
            title="Vy, the guide"
            className="fixed inset-0 z-[60] w-full h-full border-0 bg-transparent pointer-events-none"
          />
          {(bubble || error) && (
            <GuideBubble
              bubble={bubble}
              error={error}
              onNext={() => advance.current?.()}
              onClose={stop}
            />
          )}
        </>
      )}
    </GuideContext.Provider>
  );
}

const BUBBLE_WIDTH = 320;
// Narrowest the bubble may be made to fit beside her; below this its text wraps too often to read.
const MIN_SIDE_WIDTH = 170;
const BUBBLE_GAP = 18;
const SCREEN_MARGIN = 12;
const TAIL_INSET = 28;
// Colours of the finale burst: the logo ribbon's hues.
const BURST = ["hsl(var(--ribbon-coral))", "hsl(var(--ribbon-red))", "hsl(var(--ribbon-violet))", "hsl(var(--ribbon-blue))", "hsl(var(--ribbon-indigo))", "hsl(var(--ribbon-amber))"];

type Tail = "down" | "up" | "left" | "right";

interface Placement {
  style: React.CSSProperties;
  tail: Tail;
  /** Distance of the tail along its edge, in px from the bubble's left or top. */
  tailAt: number;
}

/**
 * Where the bubble goes so that it never covers her: above her head, below her feet, then
 * beside her (the side away from the target first), narrowed to the room there. The height
 * is the bubble's measured height at its current width; a narrower bubble is never shorter,
 * so a placement ruled out at one width stays ruled out at a narrower one. The tail points
 * at her from whichever edge faces her.
 */
function placeBubble(bubble: Bubble | null, height: number): Placement {
  const W = window.innerWidth, H = window.innerHeight;
  const full = Math.min(BUBBLE_WIDTH, W - 2 * SCREEN_MARGIN);
  const clampTail = (v: number, size: number) => Math.min(Math.max(v, TAIL_INSET), size - TAIL_INSET);
  if (!bubble) return { style: { left: SCREEN_MARGIN, bottom: SCREEN_MARGIN, width: full }, tail: "down", tailAt: -1 };
  const centred = Math.min(Math.max(bubble.x - full / 2, SCREEN_MARGIN), W - full - SCREEN_MARGIN);
  if (bubble.y - BUBBLE_GAP - height >= SCREEN_MARGIN) {
    return { style: { left: centred, bottom: H - bubble.y + BUBBLE_GAP, width: full }, tail: "down", tailAt: clampTail(bubble.x - centred, full) };
  }
  if (bubble.feet + BUBBLE_GAP + height <= H - SCREEN_MARGIN) {
    return { style: { left: centred, top: bubble.feet + BUBBLE_GAP, width: full }, tail: "up", tailAt: clampTail(bubble.x - centred, full) };
  }
  const bodyLeft = bubble.x - bubble.halfWidth, bodyRight = bubble.x + bubble.halfWidth;
  const room = { right: W - SCREEN_MARGIN - bodyRight - BUBBLE_GAP, left: bodyLeft - BUBBLE_GAP - SCREEN_MARGIN };
  const other = bubble.freeSide === "right" ? "left" : "right";
  const fits = (side: "left" | "right") => room[side] >= MIN_SIDE_WIDTH;
  const side = fits(bubble.freeSide) ? bubble.freeSide : fits(other) ? other : room.left > room.right ? "left" : "right";
  const width = Math.min(full, room[side]);
  const left = side === "right" ? bodyRight + BUBBLE_GAP : bodyLeft - BUBBLE_GAP - width;
  const top = Math.min(Math.max(bubble.y, SCREEN_MARGIN), H - SCREEN_MARGIN - height);
  // Beside her, the tail sits level with her face, a little below the top of her head.
  const face = bubble.y + (bubble.feet - bubble.y) * 0.12;
  return { style: { left, top, width }, tail: side === "right" ? "left" : "right", tailAt: clampTail(face - top, height || TAIL_INSET * 2) };
}

const TAIL_CLASS: Record<Tail, string> = {
  down: "bottom-[-9px] -translate-x-1/2 border-r border-b",
  up: "top-[-9px] -translate-x-1/2 border-l border-t",
  left: "left-[-9px] -translate-y-1/2 border-l border-b",
  right: "right-[-9px] -translate-y-1/2 border-r border-t",
};

function GuideBubble({ bubble, error, onNext, onClose }: { bubble: Bubble | null; error: string; onNext: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const { style, tail, tailAt } = placeBubble(bubble, height);
  // Re-measured whenever the placement changes the bubble's width, since its text rewraps.
  useLayoutEffect(() => { if (ref.current) setHeight(ref.current.offsetHeight); }, [bubble, error, style.width]);
  const text = error || bubble?.text || "";
  const auto = bubble?.holdMs != null;
  const horizontal = tail === "down" || tail === "up";

  return (
    <div
      ref={ref}
      key={text}
      role="dialog"
      aria-live="polite"
      aria-label="Vy says"
      className="fixed z-[61] animate-scale-in"
      style={{ ...style, visibility: height ? "visible" : "hidden" }}
    >
      <div className="relative rounded-[26px] bg-white/95 border border-white p-4 pb-3.5 shadow-[0_24px_60px_-18px_hsl(224_76%_40%/0.45),0_2px_6px_hsl(224_76%_40%/0.08)] backdrop-blur-xl">
        {tailAt >= 0 && (
          <span
            aria-hidden="true"
            className={`absolute w-4 h-4 rotate-45 bg-white border-white ${TAIL_CLASS[tail]}`}
            style={horizontal ? { left: tailAt } : { top: tailAt }}
          />
        )}

        <div className="flex items-center gap-2.5">
          <span className="relative grid place-items-center w-8 h-8 rounded-full p-[2px] s2s-ribbon animate-ribbon-flow shrink-0">
            <span className="grid place-items-center w-full h-full rounded-full bg-white font-display font-extrabold text-[13px] text-primary">Vy</span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display font-extrabold text-[14px] leading-none text-foreground">Vy</p>
            <p className="mt-1 text-[11px] font-semibold text-muted-foreground leading-none">
              {error ? "Tour stopped" : auto ? "Auto tour" : "Your guide"}
            </p>
          </div>
          {bubble && !error && (
            <ol className="flex items-center gap-1" aria-label={`Stop ${bubble.index + 1} of ${bubble.total}`}>
              {Array.from({ length: bubble.total }, (_, i) => (
                <li
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-500 ${i === bubble.index ? "w-5 s2s-ribbon" : i < bubble.index ? "w-1.5 bg-primary/60" : "w-1.5 bg-primary/15"}`}
                />
              ))}
            </ol>
          )}
        </div>

        <p className="mt-3 text-[16px] leading-snug font-semibold text-foreground">
          {text.split(" ").map((w, i) => (
            <span key={i} className="inline-block animate-fade-up mr-[0.28em]" style={{ animationDelay: `${120 + i * 45}ms`, animationDuration: "420ms" }}>{w}</span>
          ))}
        </p>

        {auto && bubble ? (
          <div className="mt-3.5">
            <div className="h-1 rounded-full bg-primary/10 overflow-hidden">
              <div key={bubble.index} className="h-full rounded-full s2s-ribbon origin-left animate-guide-fill" style={{ animationDuration: `${bubble.holdMs}ms` }} />
            </div>
            <p className="mt-2 text-[12px] font-semibold text-muted-foreground">Touch the screen to take over</p>
          </div>
        ) : (
          <div className="mt-3.5 flex items-center justify-between">
            <button onClick={onClose} className="inline-flex items-center gap-1 text-[13px] font-semibold text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" /> {bubble?.last || error ? "Close" : "Skip tour"}
            </button>
            {bubble && !error && (
              <button onClick={onNext} className="inline-flex items-center gap-1.5 rounded-full bg-gradient-primary text-white px-4 py-2 text-[13px] font-bold shadow-pill-soft s2s-press">
                {bubble.last ? "Done" : "Next"} <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {bubble?.last && !error && (
          <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 w-0 h-0">
            {Array.from({ length: 18 }, (_, i) => (
              <span
                key={i}
                className="s2s-burst-piece"
                style={{
                  width: i % 3 === 0 ? 10 : 7,
                  height: i % 3 === 0 ? 10 : 14,
                  background: BURST[i % BURST.length],
                  animationDelay: `${(i % 6) * 40}ms`,
                  ["--r" as string]: `${(360 / 18) * i}deg`,
                  ["--d" as string]: `${90 + (i % 4) * 26}px`,
                } as React.CSSProperties}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
