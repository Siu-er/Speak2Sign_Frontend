"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { ChevronLeft, Link2, Plus, Loader2, Check, Copy, ScanLine } from "lucide-react";
import { AppShell } from "@/app/components/shell/AppShell";
import { Pill } from "@/app/components/primitives/Pill";
import { Chip } from "@/app/components/primitives/Chip";
import { useRoom } from "@/app/hooks/useRoom";
import { Role } from "@/app/lib/transport/types";

const CAPTURE_ROUTE: Record<Role, string> = {
  speaker: "/conversation",
  signer: "/conversation",
};

const ROLE_LABEL: Record<Role, string> = {
  speaker: "Speaker",
  signer: "Signer",
};

function PairInner() {
  const router = useRouter();
  const params = useSearchParams();
  const room = useRoom();

  const roleParam = params.get("role");
  const role: Role | null =
    roleParam === "speaker" || roleParam === "signer" ? roleParam : null;

  const [mode, setMode] = useState<"choose" | "host" | "join">("choose");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");

  // The device that scans the QR takes the opposite role.
  const peerRole: Role | null = role
    ? role === "speaker" ? "signer" : "speaker"
    : null;

  // Once both devices are in the room, move to the conversation screen.
  useEffect(() => {
    if (room.peerConnected && role) {
      router.push(CAPTURE_ROUTE[role]);
    }
  }, [room.peerConnected, role, router]);

  // Build a QR encoding the deep-link the peer opens to join.
  useEffect(() => {
    if (mode !== "host" || !room.roomId || !peerRole || typeof window === "undefined") return;
    const url = `${window.location.origin}/conversation?room=${room.roomId}&role=${peerRole}`;
    QRCode.toDataURL(url, { width: 220, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [mode, room.roomId, peerRole]);

  const handleHost = useCallback(async () => {
    if (!role) return;
    setError("");
    setBusy(true);
    try {
      await room.createRoom(role);
      setMode("host");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create room");
    } finally {
      setBusy(false);
    }
  }, [role, room]);

  const handleJoin = useCallback(async () => {
    if (!role) return;
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setError("");
    setBusy(true);
    try {
      await room.joinRoom(trimmed, role);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join room");
    } finally {
      setBusy(false);
    }
  }, [role, code, room]);

  const handleCopy = useCallback(async () => {
    if (!room.roomId) return;
    await navigator.clipboard.writeText(room.roomId.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [room.roomId]);

  return (
    <AppShell showNav={false}>
      <header className="px-6 pt-6 pb-2 flex items-center justify-between">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-primary font-semibold"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm">Back</span>
        </button>
        <span className="font-display font-extrabold text-primary tracking-tight">
          S2S
        </span>
      </header>

      <main className="flex-1 px-6 pb-8 flex flex-col">
        <div className="animate-fade-up">
          <h1 className="s2s-heading text-[34px] leading-[1.08] mb-2">
            Pair your devices
          </h1>
          <p className="text-muted-foreground text-[15px] leading-relaxed">
            Connect with the other person to start the conversation.
          </p>
          {role && (
            <div className="mt-3">
              <Chip tone="primary" size="sm">
                You are the {ROLE_LABEL[role]}
              </Chip>
            </div>
          )}
        </div>

        {!role && (
          <div className="s2s-card mt-6 p-5">
            <p className="text-sm font-semibold text-foreground mb-3">
              Choose your role first
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Pill
                variant="primary"
                onClick={() => router.replace("/pair?role=speaker")}
              >
                I speak
              </Pill>
              <Pill
                variant="soft"
                onClick={() => router.replace("/pair?role=signer")}
              >
                I sign
              </Pill>
            </div>
          </div>
        )}

        {role && mode === "choose" && (
          <div className="mt-8 space-y-4 animate-fade-up">
            <button
              onClick={handleHost}
              disabled={busy}
              className="w-full s2s-card p-5 flex items-center gap-4 text-left transition-transform active:scale-[0.99] disabled:opacity-50"
            >
              <div className="w-12 h-12 rounded-2xl grid place-items-center bg-primary text-primary-foreground">
                {busy ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Plus className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-foreground">Create a room</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Get a code to share with the other device.
                </p>
              </div>
            </button>

            <button
              onClick={() => setMode("join")}
              className="w-full s2s-card p-5 flex items-center gap-4 text-left transition-transform active:scale-[0.99]"
            >
              <div className="w-12 h-12 rounded-2xl grid place-items-center bg-primary-soft text-primary">
                <Link2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-foreground">Join a room</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Enter the code from the other device.
                </p>
              </div>
            </button>
          </div>
        )}

        {role && mode === "host" && (
          <div className="mt-8 animate-fade-up">
            <div className="s2s-card p-6 text-center">
              {qrDataUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={qrDataUrl}
                  alt="Scan to join"
                  className="mx-auto mb-4 rounded-2xl border border-border"
                  width={220}
                  height={220}
                />
              )}
              <p className="s2s-eyebrow mb-3">Room code</p>
              <p className="font-display font-extrabold text-primary text-[40px] tracking-[0.2em] tabular-nums">
                {room.roomId ?? "----"}
              </p>
              <button
                onClick={handleCopy}
                className="mt-3 inline-flex items-center gap-2 text-foreground text-sm font-semibold hover:text-primary transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-success" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy code
                  </>
                )}
              </button>
            </div>
            <div className="mt-6 flex items-center justify-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Waiting for the other device to join...
            </div>
          </div>
        )}

        {role && mode === "join" && (
          <div className="mt-8 animate-fade-up">
            <div className="s2s-card p-6">
              <label className="s2s-eyebrow mb-3 block">Enter room code</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleJoin();
                }}
                placeholder="ABC123"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                className="w-full text-center font-display font-extrabold text-foreground text-3xl tracking-[0.2em] bg-secondary rounded-2xl py-4 outline-none focus:ring-2 focus:ring-primary/40"
              />
              <Pill
                variant="primary"
                fullWidth
                size="lg"
                className="mt-5"
                onClick={handleJoin}
                disabled={busy || code.trim().length === 0}
              >
                {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                Join room
              </Pill>
              <button
                onClick={() => router.push("/scan")}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 text-primary text-sm font-semibold"
              >
                <ScanLine className="w-4 h-4" />
                Scan QR code instead
              </button>
              <button
                onClick={() => setMode("choose")}
                className="mt-3 w-full text-center text-sm text-muted-foreground font-semibold"
              >
                Back
              </button>
            </div>
            {room.roomId && !room.peerConnected && (
              <div className="mt-6 flex items-center justify-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Connected. Waiting for the other device...
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="mt-5 text-center text-sm text-destructive">{error}</p>
        )}
      </main>
    </AppShell>
  );
}

export default function PairPage() {
  return (
    <Suspense fallback={null}>
      <PairInner />
    </Suspense>
  );
}
