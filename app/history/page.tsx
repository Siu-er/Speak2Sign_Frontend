"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, Mic, Trash2, Volume2, Hand, MessageSquare } from "lucide-react";
import { AppShell } from "@/app/components/shell/AppShell";
import { TopHeader } from "@/app/components/shell/TopHeader";
import { SectionHeading } from "@/app/components/primitives/SectionHeading";
import {
  ConversationRecord,
  conversationTitle,
  clearConversations,
  deleteConversation,
  listConversations,
  subscribeHistory,
} from "@/app/lib/history/history-store";

function formatWhen(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Today · ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday · ${time}`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} · ${time}`;
}

export default function HistoryPage() {
  const [query, setQuery] = useState("");
  const [records, setRecords] = useState<ConversationRecord[]>([]);

  useEffect(() => {
    const refresh = () => setRecords(listConversations());
    refresh();
    return subscribeHistory(refresh);
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return records.filter(
      (r) =>
        conversationTitle(r).toLowerCase().includes(q) ||
        r.lines.some((l) => l.text.toLowerCase().includes(q)),
    );
  }, [records, query]);

  return (
    <AppShell>
      <TopHeader />
      <main className="px-5 flex-1 pb-6 relative lg:px-12 lg:pt-10 lg:pb-10">
        <div className="flex items-center justify-between">
          <SectionHeading title="Conversation History" />
          {records.length > 0 && (
            <button
              onClick={() => clearConversations()}
              className="text-xs font-semibold text-muted-foreground hover:text-destructive inline-flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>

        {records.length > 0 && (
          <div className="mt-5 flex gap-2.5">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search conversations"
                aria-label="Search conversations"
                className="w-full h-12 pl-11 pr-4 rounded-full s2s-card text-foreground placeholder:text-muted-foreground/70 outline-none text-sm font-medium"
              />
            </div>
            <Link
              href="/pair?role=speaker"
              aria-label="New conversation"
              className="shrink-0 w-12 h-12 rounded-full grid place-items-center text-white bg-gradient-primary shadow-pill s2s-press"
            >
              <Mic className="w-5 h-5" />
            </Link>
          </div>
        )}

        <div className="mt-5 space-y-3 lg:grid lg:grid-cols-2 lg:gap-5 lg:space-y-0 lg:items-start">
          {records.length === 0 ? (
            <div className="s2s-card mt-4 px-6 py-10 text-center">
              <div className="mx-auto w-16 h-16 rounded-full p-[3px] s2s-ribbon">
                <div className="w-full h-full rounded-full bg-white grid place-items-center text-primary">
                  <MessageSquare className="w-7 h-7" />
                </div>
              </div>
              <p className="mt-4 font-display font-extrabold text-[19px] text-foreground">No conversations yet</p>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed max-w-[28ch] mx-auto">
                Every line spoken and signed in a conversation is kept here, on this device.
              </p>
              <Link
                href="/pair?role=speaker"
                className="mt-5 inline-flex items-center gap-2 px-5 py-3 rounded-full bg-gradient-primary text-white text-sm font-bold shadow-pill s2s-press"
              >
                <Mic className="w-4 h-4" /> Start a conversation
              </Link>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground text-sm">
              No conversations match your search.
            </p>
          ) : (
            filtered.map((r, i) => {
              const preview = r.lines[r.lines.length - 1]?.text ?? "";
              return (
                <div
                  key={r.id}
                  className="s2s-card p-5 animate-fade-up"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="flex items-center justify-between">
                    <p className="s2s-label text-primary">
                      {formatWhen(r.startedAt)}
                    </p>
                    <button
                      onClick={() => deleteConversation(r.id)}
                      className="text-muted-foreground/60 hover:text-destructive"
                      aria-label="Delete conversation"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <h3 className="mt-1 font-display font-extrabold text-foreground text-lg leading-tight">
                    {conversationTitle(r)}
                  </h3>
                  <p className="mt-1.5 text-muted-foreground text-sm leading-relaxed line-clamp-2">
                    &ldquo;{preview}&rdquo;
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Tag icon={<Volume2 className="w-3 h-3" />} label={`${r.lines.filter((l) => l.role === "speaker").length} spoken`} />
                    <Tag icon={<Hand className="w-3 h-3" />} label={`${r.lines.filter((l) => l.role === "signer").length} signed`} />
                  </div>
                </div>
              );
            })
          )}
        </div>

      </main>
    </AppShell>
  );
}

function Tag({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-secondary text-secondary-foreground inline-flex items-center gap-1">
      {icon}
      {label}
    </span>
  );
}
