"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import { ChevronLeft } from "lucide-react";
import { AppShell } from "@/app/components/shell/AppShell";

/** Camera QR scanner. Decodes a /conversation deep-link and navigates to it. */
export default function ScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const handledRef = useRef(false);

  const [error, setError] = useState("");
  const [status, setStatus] = useState("Point the camera at the QR code");

  const stop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const handleDecoded = useCallback(
    (data: string) => {
      if (handledRef.current) return;
      let target: string | null = null;
      try {
        const url = new URL(data);
        const room = url.searchParams.get("room");
        const role = url.searchParams.get("role");
        if (room && (role === "speaker" || role === "signer")) {
          target = `/conversation?room=${room.toUpperCase()}&role=${role}`;
        }
      } catch {
        target = null;
      }
      if (!target) {
        setStatus("That code is not a pairing link. Keep scanning...");
        return;
      }
      handledRef.current = true;
      setStatus("Joining...");
      stop();
      router.push(target);
    },
    [router, stop],
  );

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

        const tick = () => {
          if (video.readyState >= 2 && video.videoWidth > 0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(img.data, img.width, img.height, {
              inversionAttempts: "dontInvert",
            });
            if (code?.data) handleDecoded(code.data);
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Camera unavailable");
      }
    };
    start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [handleDecoded, stop]);

  return (
    <AppShell showNav={false}>
      <header className="px-6 pt-6 pb-2 flex items-center justify-between">
        <button
          onClick={() => router.push("/pair")}
          className="flex items-center gap-2 text-primary font-semibold"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm">Back</span>
        </button>
        <span className="font-display font-extrabold text-primary tracking-tight">S2S</span>
      </header>

      <main className="flex-1 px-6 pb-8 flex flex-col">
        <h1 className="s2s-heading text-[30px] leading-[1.1] mb-2">Scan to join</h1>
        <p className="text-muted-foreground text-sm mb-5">{status}</p>

        <div className="relative rounded-[28px] overflow-hidden bg-ink aspect-square shadow-card">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay playsInline muted
          />
          <canvas ref={canvasRef} className="hidden" />
          <div className="absolute inset-10 border-2 border-primary-bright/70 rounded-3xl pointer-events-none" />
        </div>

        {error && <p className="mt-5 text-center text-sm text-destructive">{error}</p>}
      </main>
    </AppShell>
  );
}
