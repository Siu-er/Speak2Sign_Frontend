"use client";

import React from "react";
import Image from "next/image";
import { Globe, Volume2, Type, Contrast, Vibrate, User, KeyRound } from "lucide-react";
import { AppShell } from "@/app/components/shell/AppShell";
import { TopHeader } from "@/app/components/shell/TopHeader";
import { SectionHeading } from "@/app/components/primitives/SectionHeading";
import { Toggle } from "@/app/components/primitives/Toggle";
import { Slider } from "@/app/components/primitives/Slider";
import { useSettings } from "@/app/hooks/useSettings";
import {
  AVATARS,
  SUPPORTED_LANGUAGES,
  VOICE_TONES,
  VoiceTone,
} from "@/app/lib/config/settings";

export default function SettingsPage() {
  const { settings: s, update } = useSettings();

  return (
    <AppShell>
      <TopHeader />
      <main className="px-6 flex-1 pb-6 lg:px-12 lg:pt-10 lg:pb-10 lg:columns-2 lg:gap-6">
        <SectionHeading
          className="[column-span:all] lg:mb-6"
          title="Settings"
          description="Customize your experience for maximum clarity and comfort."
        />

        {/* Language */}
        <div className="mt-4 s2s-card p-5 lg:mt-0 lg:mb-6 break-inside-avoid">
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
        <div data-guide="settings-signer" className="mt-4 s2s-card p-5 lg:mt-0 lg:mb-6 break-inside-avoid">
          <SettingHead
            icon={<User className="w-4 h-4" />}
            title="Signer"
            description="The character who signs what the other person says."
          />
          <div className="mt-4 grid grid-cols-3 gap-2.5" role="radiogroup" aria-label="Signer">
            {AVATARS.map((a) => {
              const chosen = s.avatar === a.id;
              return (
                <button
                  key={a.id}
                  role="radio"
                  aria-checked={chosen}
                  onClick={() => update({ avatar: a.id })}
                  className={`relative rounded-[20px] p-1.5 pb-2.5 text-center s2s-press transition-shadow ${
                    chosen ? "bg-white shadow-pill ring-2 ring-primary" : "bg-white/60 border border-white hover:bg-white"
                  }`}
                >
                  <Image src={`/avatars/${a.id}.png`} alt="" width={240} height={240} className="w-full aspect-square rounded-[15px] object-cover bg-slate-100" />
                  <span className={`mt-1.5 block text-[13px] font-bold ${chosen ? "text-primary" : "text-foreground"}`}>{a.label}</span>
                  {chosen && <span aria-hidden="true" className="absolute inset-x-6 bottom-1 h-[3px] rounded-full s2s-ribbon" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Voice Options */}
        <div className="mt-4 s2s-card p-5 lg:mt-0 lg:mb-6 break-inside-avoid">
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
        <div className="mt-4 s2s-card p-5 lg:mt-0 lg:mb-6 break-inside-avoid">
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

        {/* Team device */}
        <div className="mt-4 s2s-card p-5 lg:mt-0 lg:mb-6 break-inside-avoid">
          <SettingHead
            icon={<KeyRound className="w-4 h-4" />}
            title="Team device"
            description="The S2S team's key. With it, this device is never asked to wait between translations."
          />
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            aria-label="Team device key"
            placeholder="Team key"
            value={s.deviceKey}
            onChange={(e) => update({ deviceKey: e.target.value.trim() })}
            className="mt-4 w-full h-12 px-4 rounded-2xl bg-white border border-border text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
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
