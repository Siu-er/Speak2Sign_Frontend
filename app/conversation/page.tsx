"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PhoneOff } from "lucide-react";
import { AppShell } from "@/app/components/shell/AppShell";
import { Chip } from "@/app/components/primitives/Chip";
import { Pill } from "@/app/components/primitives/Pill";
import { SpeakerConversation } from "@/app/components/conversation/SpeakerConversation";
import { SignerConversation } from "@/app/components/conversation/SignerConversation";
import { useRoom } from "@/app/hooks/useRoom";
import { Role } from "@/app/lib/transport/types";

export default function ConversationPage() {
  const router = useRouter();
  const room = useRoom();
  const [joinError, setJoinError] = useState("");

  const joinRoom = room.joinRoom;
  const paired = !!room.roomId;

  // Deep-link join: /conversation?room=CODE&role=speaker|signer
  useEffect(() => {
    if (paired || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("room");
    const r = params.get("role");
    if (code && (r === "speaker" || r === "signer")) {
      joinRoom(code.toUpperCase(), r as Role).catch((e) =>
        setJoinError(e instanceof Error ? e.message : "Could not join room"),
      );
    }
  }, [paired, joinRoom]);

  const handleEnd = () => {
    room.leaveRoom();
    router.push("/");
  };

  if (!paired) {
    return (
      <AppShell showNav={false}>
        <main className="flex-1 px-6 flex flex-col items-center justify-center text-center gap-5">
          <p className="s2s-heading text-2xl">Not in a conversation</p>
          <p className="text-muted-foreground text-sm max-w-[80%]">
            {joinError || "Pair with the other device to begin."}
          </p>
          <Pill variant="primary" size="lg" onClick={() => router.push("/")}>
            Go to pairing
          </Pill>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell showNav={false}>
      <header className="px-6 pt-5 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Chip tone="neutral" size="sm">Room {room.roomId}</Chip>
          <Chip tone={room.peerConnected ? "success" : "amber"} size="sm">
            {room.peerConnected ? "Connected" : "Waiting"}
          </Chip>
        </div>
        <button
          onClick={handleEnd}
          className="inline-flex items-center gap-1.5 text-destructive font-semibold text-sm hover:opacity-80 transition-opacity"
        >
          <PhoneOff className="w-4 h-4" />
          End
        </button>
      </header>

      {(room.status === "reconnecting" || room.status === "connecting" || room.error) && (
        <div
          className={`mx-6 mb-2 rounded-xl px-4 py-2 text-sm font-semibold flex items-center gap-2 ${
            room.error ? "bg-destructive/10 text-destructive" : "bg-amber-100 text-amber-700"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${room.error ? "bg-destructive" : "bg-amber-500 animate-pulse"}`} />
          {room.error
            ? room.error
            : room.status === "reconnecting"
            ? "Reconnecting..."
            : "Connecting..."}
        </div>
      )}

      <main className="flex-1 px-6 pb-4">
        {room.role === "speaker" ? <SpeakerConversation /> : <SignerConversation />}
      </main>
    </AppShell>
  );
}
