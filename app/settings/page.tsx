"use client";

import React from "react";
import { Globe, Volume2, Type, Contrast, Vibrate, User } from "lucide-react";
import { AppShell } from "@/app/components/shell/AppShell";
import { TopHeader } from "@/app/components/shell/TopHeader";
import { SectionHeading } from "@/app/components/primitives/SectionHeading";
import { Toggle } from "@/app/components/primitives/Toggle";
import { Slider } from "@/app/components/primitives/Slider";
import { useSettings } from "@/app/hooks/useSettings";
import {
  AVATARS,
  AvatarId,
  SUPPORTED_LANGUAGES,
  VOICE_TONES,
  VoiceTone,
} from "@/app/lib/config/settings";

export default function SettingsPage() {
  const { settings: s, update } = useSettings();

  return (
    <AppShell>
      <TopHeader />
      <main className="px-6 flex-1 pb-6">
        <SectionHeading
          title="Settings"
          description="Customize your experience for maximum clarity and comfort."
        />

        {/* Language */}
        <div className="mt-6 s2s-card p-5">
          <SettingHead
            icon={<Globe className="w-4 h-4" />}
            title="Language"
            description="Spoken-input language. Non-English is translated to English before signing."
          />
          <div className="mt-4 relative">
            <select
              value={s.language}
              onChange={(e) => update({ language: e.target.value })}
              className="w-full h-12 px-4 rounded-2xl bg-white border border-border text-sm font-semibold appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.label} value={l.label}>
                  {l.label}
                  {l.translate ? "  (translated)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Avatar */}
        <div className="mt-4 s2s-card p-5">
          <SettingHead
            icon={<User className="w-4 h-4" />}
            title="Sign Avatar"
            description="Choose the signer shown when the other person speaks."
          />
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            {AVATARS.map((a: AvatarId) => (
              <button
                key={a}
                onClick={() => update({ avatar: a })}
                className={`h-11 rounded-full text-sm font-semibold capitalize transition-all ${
                  s.avatar === a
                    ? "s2s-pill-primary"
                    : "bg-white border border-border text-foreground hover:border-primary/30"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Voice Options */}
        <div className="mt-4 s2s-card p-5">
          <SettingHead
            icon={<Volume2 className="w-4 h-4" />}
            title="Voice Options"
            description="Adjust synthesized speech parameters."
          />

          <div className="mt-5">
            <div className="flex justify-between mb-2">
              <span className="text-sm font-bold text-foreground">Playback Speed</span>
              <span className="text-sm font-bold text-primary">{s.playbackSpeed.toFixed(1)}x</span>
            </div>
            <Slider
              value={s.playbackSpeed}
              min={0.5}
              max={2}
              step={0.1}
              onChange={(v) => update({ playbackSpeed: v })}
            />
            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
              <span>Slower</span>
              <span>Normal</span>
              <span>Faster</span>
            </div>
          </div>

          <p className="mt-5 text-sm font-bold text-foreground">Voice Tone</p>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {VOICE_TONES.map((t: VoiceTone) => (
              <button
                key={t}
                onClick={() => update({ voiceTone: t })}
                className={`h-11 rounded-full text-sm font-semibold transition-all ${
                  s.voiceTone === t
                    ? "s2s-pill-primary"
                    : "bg-white border border-border text-foreground hover:border-primary/30"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Accessibility */}
        <div className="mt-4 s2s-card p-5">
          <h3 className="font-display font-extrabold text-foreground text-lg">Accessibility Features</h3>

          <div className="mt-4 s2s-card p-4 shadow-none border border-border bg-background-deep/30">
            <div className="flex items-center gap-2 mb-2">
              <Type className="w-4 h-4 text-foreground" />
              <span className="text-sm font-bold">Display Text Size</span>
            </div>
            <Slider
              value={s.textSize}
              min={0}
              max={100}
              step={1}
              onChange={(v) => update({ textSize: v })}
            />
            <p
              className="mt-3 text-center text-foreground font-semibold"
              style={{ fontSize: `${14 + (s.textSize / 100) * 10}px` }}
            >
              Preview Text
            </p>
          </div>

          <ToggleRow
            icon={<Contrast className="w-4 h-4" />}
            label="High Contrast"
            description="Increases visibility of elements by using higher color ratios."
            value={s.highContrast}
            onChange={(v) => update({ highContrast: v })}
          />
          <ToggleRow
            icon={<Vibrate className="w-4 h-4" />}
            label="Haptic Feedback"
            description="Physical vibration for alerts and transcription milestones."
            value={s.haptic}
            onChange={(v) => update({ haptic: v })}
          />
        </div>

        {/* History card */}
        <div className="mt-4 rounded-[28px] p-5 s2s-surface-primary relative overflow-hidden">
          <h3 className="font-display font-extrabold text-xl">Conversation History</h3>
          <p className="mt-2 text-sm opacity-90 leading-relaxed">
            Keep a transcript of all your past conversations. Stored only on this device.
          </p>
          <div className="mt-5 flex items-center justify-between bg-black/15 rounded-full px-4 py-2.5 backdrop-blur">
            <span className="text-sm font-semibold">Recording History</span>
            <Toggle
              value={s.recordingHistory}
              onChange={(v) => update({ recordingHistory: v })}
              onDark
            />
          </div>
        </div>
      </main>
    </AppShell>
  );
}

function SettingHead({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-2xl bg-primary text-primary-foreground grid place-items-center">
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="font-display font-extrabold text-foreground text-lg leading-tight">
          {title}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function ToggleRow({
  icon,
  label,
  description,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="mt-3 s2s-card p-4 shadow-none border border-border bg-background-deep/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-primary">{icon}</span>
          <span className="text-sm font-bold text-foreground">{label}</span>
        </div>
        <Toggle value={value} onChange={onChange} />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
