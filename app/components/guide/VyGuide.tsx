"use client";

import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, X } from "lucide-react";

/** Gestures a step can ask for; "point" is resolved to a direction from the target's position. */
type Gesture = "hello" | "point" | "peace" | "cheer" | "bow" | "think";

interface TourStep {
  path: string;
  /** Value of the data-guide attribute on the element the step is about. */
  target: string;
  gesture: Gesture;
  say: string;
}

const TOUR: TourStep[] = [
  { path: "/", target: "home-hero", gesture: "hello", say: "Hi, I'm Vy! I live in here. Let me show you around." },
  { path: "/", target: "home-live", gesture: "point", say: "Say or type anything here, and I sign it for you, live." },
  { path: "/", target: "home-roles", gesture: "point", say: "Talking with someone? Pick a side. You speak or you sign, and I translate both ways." },
  { path: "/", target: "home-explore", gesture: "point", say: "Everything else lives down here: the dictionary, practice and the call companion." },
  { path: "/dictionary", target: "dictionary-search", gesture: "point", say: "Forgot a sign? Search for it and I'll show you how it goes." },
  { path: "/settings", target: "settings-signer", gesture: "peace", say: "You can pick a different signer here. I'll pretend not to be hurt." },
  { path: "/", target: "home-hero", gesture: "cheer", say: "That's the tour! Now go and say something." },
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

interface GuideApi {
  start: () => void;
  running: boolean;
}

const GuideContext = createContext<GuideApi | null>(null);

export function useGuide(): GuideApi {
  const api = useContext(GuideContext);
  if (!api) throw new Error("useGuide must be used inside <VyGuideProvider>");
  return api;
}

interface Bubble {
  text: string;
  /** Screen x of the character's centre and y of the top of her head. */
  x: number;
  y: number;
  halfWidth: number;
  /** The side of the character that faces away from the target. */
  freeSide: "left" | "right";
  last: boolean;
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

  const run = useCallback(async () => {
    const ready = once("vy-ready");
    setRunning(true);
    await ready;
    const W = window.innerWidth, H = window.innerHeight;
    const height = Math.min(H * HEIGHT_OF_VIEWPORT, MAX_HEIGHT_PX);
    const half = height * HALF_WIDTH;
    send({ type: "vy-config", height });
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
      send({ type: "vy-walk", x, y: feet });
      await arrived;
      if (cancelled.current) return;

      let clip: string = step.gesture;
      if (step.gesture === "point") {
        const hand = feet - HAND_HEIGHT * height;
        // She faces the viewer: her left arm points to the screen's right.
        clip = hand > r.bottom ? "pointUp" : pointsRight ? "pointLeft" : "pointRight";
      }
      send({ type: "vy-play", clip });
      setBubble({ text: step.say, x, y: feet - height, halfWidth: half, freeSide: pointsRight ? "left" : "right", last: i === TOUR.length - 1 });
      await new Promise<void>((resolve) => { advance.current = resolve; });
      advance.current = null;
    }
    stop();
  }, [once, router, send, stop]);

  const start = useCallback(() => {
    if (running) return;
    cancelled.current = false;
    run().catch((e: Error) => setError(e.message));
  }, [run, running]);

  return (
    <GuideContext.Provider value={{ start, running }}>
      {children}
      {running && (
        <>
          {spot && (
            <div
              aria-hidden="true"
              className="fixed z-[59] pointer-events-none rounded-[28px] transition-all duration-500 ring-4 ring-primary/60 shadow-[0_0_0_9999px_rgba(20,16,40,0.18)]"
              style={{ left: spot.left - 8, top: spot.top - 8, width: spot.width + 16, height: spot.height + 16 }}
            />
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

const BUBBLE_WIDTH = 300;
const BUBBLE_GAP = 14;
const SCREEN_MARGIN = 12;

/** Above her head when it fits on screen, otherwise beside her head on the side away from the target. */
function bubbleStyle(bubble: Bubble | null, height: number): React.CSSProperties {
  const W = window.innerWidth, H = window.innerHeight;
  const clampX = (left: number) => Math.min(Math.max(left, SCREEN_MARGIN), W - BUBBLE_WIDTH - SCREEN_MARGIN);
  if (!bubble) return { left: SCREEN_MARGIN, bottom: SCREEN_MARGIN, width: BUBBLE_WIDTH };
  if (bubble.y - BUBBLE_GAP - height >= SCREEN_MARGIN) {
    return { left: clampX(bubble.x - BUBBLE_WIDTH / 2), bottom: H - bubble.y + BUBBLE_GAP, width: BUBBLE_WIDTH };
  }
  const left = bubble.freeSide === "right"
    ? bubble.x + bubble.halfWidth + BUBBLE_GAP
    : bubble.x - bubble.halfWidth - BUBBLE_GAP - BUBBLE_WIDTH;
  return { left: clampX(left), top: Math.max(bubble.y, SCREEN_MARGIN), width: BUBBLE_WIDTH };
}

function GuideBubble({ bubble, error, onNext, onClose }: { bubble: Bubble | null; error: string; onNext: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => { if (ref.current) setHeight(ref.current.offsetHeight); }, [bubble, error]);
  return (
    <div
      ref={ref}
      role="dialog"
      aria-live="polite"
      aria-label="Vy says"
      className="fixed z-[61] s2s-card p-4 animate-scale-in"
      style={{ ...bubbleStyle(bubble, height), visibility: height ? "visible" : "hidden" }}
    >
      <p className="font-display font-extrabold text-[13px] text-primary">Vy</p>
      <p className="mt-1 text-[15px] leading-snug text-foreground">{error || bubble?.text}</p>
      <div className="mt-3 flex items-center justify-between">
        <button onClick={onClose} className="inline-flex items-center gap-1 text-[13px] font-semibold text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" /> {bubble?.last || error ? "Close" : "Skip tour"}
        </button>
        {bubble && !error && (
          <button onClick={bubble.last ? onClose : onNext} className="inline-flex items-center gap-1.5 rounded-full bg-gradient-primary text-white px-4 py-2 text-[13px] font-bold shadow-pill-soft s2s-press">
            {bubble.last ? "Done" : "Next"} <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
