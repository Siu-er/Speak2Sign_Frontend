"use client";

import React, { useEffect, useState } from "react";
import { Mic, Hand, LogOut } from "lucide-react";
import { AppShell } from "@/app/components/shell/AppShell";
import { S2SLogo } from "@/app/components/shell/S2SLogo";
import { Chip } from "@/app/components/primitives/Chip";
import { SpeakerConversation } from "@/app/components/conversation/SpeakerConversation";
import { SignerConversation } from "@/app/components/conversation/SignerConversation";
import { useRoom } from "@/app/hooks/useRoom";
import { MEETING_CODE_PATTERN, Role, RoleCounts } from "@/app/lib/transport/types";

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

function membersLabel(counts: RoleCounts): string {
  return `${plural(counts.speaker, "speaker")}, ${plural(counts.signer, "signer")}`;
}

/**
 * Google Meet panel, loaded by the S2S browser extension beside a call as
 * /meet?code=<meeting code>. Everyone in the call who opens the panel joins
 * one room keyed by the meeting code; speech reaches every signer as the
 * avatar and signs reach every speaker as text and voice.
 */
export default function MeetPage() {
  const room = useRoom();
  const [meetingCode, setMeetingCode] = useState<string | null>(null);
  const [codeError, setCodeError] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) setCodeError("No meeting code was given. Open this panel from a Google Meet call.");
    else if (!MEETING_CODE_PATTERN.test(code)) setCodeError(`"${code}" is not a Google Meet meeting code.`);
    else setMeetingCode(code);
  }, []);

  const leaveRoom = room.leaveRoom;
  useEffect(() => () => leaveRoom(), [leaveRoom]);

  const choose = async (role: Role) => {
    if (!meetingCode) return;
    setJoinError("");
    setJoining(true);
    try {
      await room.joinMeeting(meetingCode, role);
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : String(e));
    } finally {
      setJoining(false);
    }
  };

  const joined = room.roomId !== null && room.role !== null;

  return (
    <AppShell showNav={false}>
      <header className="px-4 pt-4 pb-2 flex items-center justify-between gap-2">
        <S2SLogo height={26} />
        {meetingCode && <Chip tone="neutral" size="xs">{meetingCode}</Chip>}
      </header>

      {codeError ? (
        <main className="flex-1 px-6 flex items-center justify-center text-center">
          <p className="text-sm text-destructive">{codeError}</p>
        </main>
      ) : !joined ? (
        <main className="flex-1 px-4 pb-6 flex flex-col justify-center gap-3">
          <p className="s2s-heading text-xl text-center">How will you take part?</p>
          <p className="text-center text-sm text-muted-foreground mb-2">
            Everyone in this call who opens S2S joins the same conversation.
          </p>
          <RoleButton
            icon={<Mic className="w-6 h-6" />}
            title="I speak"
            subtitle="Your speech is signed for the signers in the call."
            disabled={joining || !meetingCode}
            onClick={() => choose("speaker")}
          />
          <RoleButton
            icon={<Hand className="w-6 h-6" />}
            title="I sign"
            subtitle="Speech arrives as signing; your signs reach the speakers as text and voice."
            disabled={joining || !meetingCode}
            onClick={() => choose("signer")}
          />
          {joinError && <p className="text-center text-xs text-destructive">{joinError}</p>}
        </main>
      ) : (
        <>
          <div className="px-4 pb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
              <Chip tone="primary" size="xs">{room.role === "speaker" ? "Speaker" : "Signer"}</Chip>
              <Chip tone={room.peerConnected ? "success" : "amber"} size="xs">{membersLabel(room.counts)}</Chip>
            </div>
            <button
              onClick={leaveRoom}
              className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-destructive transition-colors shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" /> Change role
            </button>
          </div>

          {(room.status === "reconnecting" || room.status === "connecting" || room.error) && (
            <div
              className={`mx-4 mb-2 rounded-xl px-3 py-2 text-xs font-semibold ${
                room.error ? "bg-destructive/10 text-destructive" : "bg-amber-100 text-amber-700"
              }`}
            >
              {room.error ?? (room.status === "reconnecting" ? "Reconnecting..." : "Connecting...")}
            </div>
          )}

          <main className="flex-1 px-4 pb-4">
            {room.role === "speaker" ? <SpeakerConversation /> : <SignerConversation />}
          </main>
        </>
      )}
    </AppShell>
  );
}

interface RoleButtonProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  disabled: boolean;
  onClick: () => void;
}

function RoleButton({ icon, title, subtitle, disabled, onClick }: RoleButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="s2s-card p-4 flex items-center gap-3 text-left hover:ring-2 hover:ring-primary/30 transition disabled:opacity-50"
    >
      <span className="w-11 h-11 shrink-0 rounded-full grid place-items-center bg-primary-soft text-primary">{icon}</span>
      <span className="min-w-0">
        <span className="block font-display font-extrabold text-foreground">{title}</span>
        <span className="block text-xs text-muted-foreground leading-snug">{subtitle}</span>
      </span>
    </button>
  );
}
