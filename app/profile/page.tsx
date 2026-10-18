"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Hand, MessageSquare, Mic, RotateCcw, Trash2, TriangleAlert } from "lucide-react";
import { AppShell } from "@/app/components/shell/AppShell";
import { PageHeader } from "@/app/components/shell/PageHeader";
import { SignAvatar, AvatarClip } from "@/app/components/avatar/SignAvatar";
import { useProfile } from "@/app/hooks/useProfile";
import { profileInitials } from "@/app/lib/config/profile-store";
import { ONBOARDED_STORAGE_KEY } from "@/app/lib/config/onboarding";
import { clearConversations, ConversationRecord, listConversations, subscribeHistory } from "@/app/lib/history/history-store";
import { textToSign } from "@/app/lib/pipeline/backend";

// A destructive action needs a second tap within this window.
const CONFIRM_WINDOW_MS = 3000;

export default function ProfilePage() {
  const router = useRouter();
  const { profile, update } = useProfile();
  const [records, setRecords] = useState<ConversationRecord[]>([]);
  const [clips, setClips] = useState<AvatarClip[]>([]);
  const [spellError, setSpellError] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const idRef = useRef(0);

  useEffect(() => {
    const refresh = () => setRecords(listConversations());
    refresh();
    return subscribeHistory(refresh);
  }, []);

  useEffect(() => {
    if (!confirmClear) return;
    const t = setTimeout(() => setConfirmClear(false), CONFIRM_WINDOW_MS);
    return () => clearTimeout(t);
  }, [confirmClear]);

  const lines = records.flatMap((r) => r.lines);
  const stats = [
    { icon: <MessageSquare className="w-4 h-4" />, value: records.length, label: "Conversations" },
    { icon: <Mic className="w-4 h-4" />, value: lines.filter((l) => l.role === "speaker").length, label: "Spoken" },
    { icon: <Hand className="w-4 h-4" />, value: lines.filter((l) => l.role === "signer").length, label: "Signed" },
  ];

  const initials = profileInitials(profile.name);
  const name = profile.name.trim();

  const spellName = () => {
    setSpellError("");
    textToSign(name)
      .then(({ sigml, nonManual }) => setClips((prev) => [...prev, { id: idRef.current++, sigml, nonManual }]))
      .catch((e: Error) => setSpellError(e.message));
  };

  const replayIntroduction = () => {
    localStorage.removeItem(ONBOARDED_STORAGE_KEY);
    router.replace("/onboarding");
  };

  return (
    <AppShell showNav={false}>
      <PageHeader backHref="/" title="You" subtitle="Kept on this device only" />
      <main className="px-5 pb-8 flex-1 flex flex-col gap-4">
        <section className="s2s-card p-5 flex items-center gap-4">
          <div className="relative w-[72px] h-[72px] shrink-0 rounded-full p-[3px] s2s-ribbon">
            <div className="w-full h-full rounded-full bg-white grid place-items-center">
              {initials ? (
                <span className="font-display font-extrabold text-2xl text-primary">{initials}</span>
              ) : (
                <User className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
          </div>
          <label className="flex-1 min-w-0">
            <span className="s2s-label text-muted-foreground">Your name</span>
            <input
              value={profile.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="Add your name"
              className="mt-0.5 w-full bg-transparent outline-none font-display font-extrabold text-[22px] text-foreground placeholder:text-muted-foreground/50"
            />
          </label>
        </section>

        <section className="s2s-card p-2.5 flex items-center gap-3">
          <SignAvatar clips={clips} variant="thumb" className="w-28 h-32 shrink-0" />
          <div className="min-w-0 pr-2">
            <p className="font-display font-bold text-foreground leading-snug">Your name in sign</p>
            <p className="text-[12px] text-muted-foreground leading-snug mt-0.5">
              Names are fingerspelled, one letter at a time.
            </p>
            <button
              onClick={spellName}
              disabled={!name}
              className="mt-2.5 px-4 py-2 rounded-full bg-gradient-primary text-white text-[13px] font-bold shadow-pill-soft disabled:opacity-40 s2s-press"
            >
              Fingerspell my name
            </button>
            {spellError && (
              <p className="mt-1.5 flex items-start gap-1 text-[12px] font-semibold text-destructive"><TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-px" /> {spellError}</p>
            )}
          </div>
        </section>

        <section className="grid grid-cols-3 gap-2.5">
          {stats.map((s) => (
            <div key={s.label} className="s2s-card rounded-[20px] p-3.5">
              <span className="w-8 h-8 rounded-xl grid place-items-center bg-primary-soft text-primary">{s.icon}</span>
              <p className="mt-2 font-display font-extrabold text-[24px] leading-none text-foreground tabular-nums">{s.value}</p>
              <p className="mt-1 text-[12px] font-semibold text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </section>

        <section className="s2s-card divide-y divide-border/70 overflow-hidden">
          <button onClick={replayIntroduction} className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/60 transition-colors">
            <RotateCcw className="w-4 h-4 text-primary" />
            <span className="font-semibold text-foreground text-[15px]">Show the introduction again</span>
          </button>
          <button
            onClick={() => {
              if (!confirmClear) { setConfirmClear(true); return; }
              clearConversations();
              setConfirmClear(false);
            }}
            disabled={records.length === 0}
            className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/60 transition-colors disabled:opacity-40"
          >
            <Trash2 className="w-4 h-4 text-destructive" />
            <span className="font-semibold text-destructive text-[15px]">
              {confirmClear ? "Tap again to delete all conversations" : "Delete conversation history"}
            </span>
          </button>
        </section>
      </main>
    </AppShell>
  );
}
