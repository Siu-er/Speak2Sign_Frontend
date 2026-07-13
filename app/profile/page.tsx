"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Phone, FileText, Lock, HelpCircle, LogOut, Pencil, Check, User } from "lucide-react";
import { AppShell } from "@/app/components/shell/AppShell";
import { TopHeader } from "@/app/components/shell/TopHeader";
import { ListGroup, ListRow } from "@/app/components/primitives/ListRow";
import { useProfile } from "@/app/hooks/useProfile";
import { profileInitials } from "@/app/lib/config/profile-store";
import { PROFILE_STORAGE_KEY } from "@/app/lib/config/profile-store";
import { ONBOARDED_STORAGE_KEY } from "@/app/lib/config/onboarding";

export default function ProfilePage() {
  const router = useRouter();
  const { profile, update } = useProfile();
  const [editing, setEditing] = useState(false);

  const initials = profileInitials(profile.name);

  const logout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(PROFILE_STORAGE_KEY);
      localStorage.removeItem(ONBOARDED_STORAGE_KEY);
    }
    update({ name: "", email: "", phone: "" });
    router.replace("/onboarding");
  };

  return (
    <AppShell>
      <TopHeader />
      <main className="px-6 flex-1 pb-6">
        <div className="mt-4 flex flex-col items-center">
          <div className="w-28 h-28 rounded-[28px] shadow-pill grid place-items-center bg-gradient-primary">
            <span className="font-display font-extrabold text-white text-3xl">{initials}</span>
          </div>
          {editing ? (
            <input
              value={profile.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="Your name"
              className="mt-4 w-full max-w-[260px] text-center font-display font-extrabold text-foreground text-2xl bg-transparent border-b border-border outline-none focus:border-primary"
            />
          ) : (
            <h1 className="mt-4 font-display font-extrabold text-foreground text-3xl">
              {profile.name || "Your Profile"}
            </h1>
          )}
        </div>

        <Section
          title="Personal Information"
          action={
            <button
              onClick={() => setEditing((v) => !v)}
              className="text-xs font-semibold text-primary inline-flex items-center gap-1"
            >
              {editing ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
              {editing ? "Done" : "Edit"}
            </button>
          }
        >
          {editing ? (
            <div className="space-y-3">
              <EditField
                icon={<User className="w-4 h-4" />}
                label="Name"
                value={profile.name}
                placeholder="Your name"
                onChange={(v) => update({ name: v })}
              />
              <EditField
                icon={<Mail className="w-4 h-4" />}
                label="Email"
                value={profile.email}
                placeholder="you@example.com"
                type="email"
                onChange={(v) => update({ email: v })}
              />
              <EditField
                icon={<Phone className="w-4 h-4" />}
                label="Phone"
                value={profile.phone}
                placeholder="Phone number"
                type="tel"
                onChange={(v) => update({ phone: v })}
              />
            </div>
          ) : (
            <ListGroup>
              <ListRow
                icon={<Mail className="w-4 h-4" />}
                label="Email"
                value={profile.email || "Not set"}
              />
              <ListRow
                icon={<Phone className="w-4 h-4" />}
                label="Phone"
                value={profile.phone || "Not set"}
              />
            </ListGroup>
          )}
        </Section>

        <Section title="Account Settings">
          <div className="space-y-3">
            <ListRow asCard icon={<FileText className="w-4 h-4" />} label="Terms and Conditions" />
            <ListRow asCard icon={<Lock className="w-4 h-4" />} label="Privacy & Security" />
            <ListRow asCard icon={<HelpCircle className="w-4 h-4" />} label="Help Center" />
          </div>
        </Section>

        <button
          onClick={logout}
          className="mt-8 w-full h-14 rounded-full bg-primary-soft/70 text-destructive font-bold inline-flex items-center justify-center gap-2 text-sm"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </main>
    </AppShell>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-7">
      <div className="flex items-center justify-between mb-3">
        <h2 className="s2s-eyebrow">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function EditField({
  icon,
  label,
  value,
  placeholder,
  type = "text",
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  placeholder: string;
  type?: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="s2s-card p-4 flex items-center gap-3">
      <span className="text-primary">{icon}</span>
      <span className="text-sm font-bold text-foreground w-16 shrink-0">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent text-right text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/60"
      />
    </label>
  );
}
