// ============================================================
// Settings Page — /profile/settings
//
// MVP settings grouped into simple sections.
// Sections: Account, Privacy, Help / About.
// Most options currently show lightweight placeholders.
// ============================================================

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabase";

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const showComingSoon = (feature: string) => {
    setInfoMessage(`${feature} — Coming soon`);
  };

  const showFeedbackPlaceholder = () => {
    setInfoMessage("Feedback form coming soon");
  };

  const showAbout = () => {
    setInfoMessage(
      "GoSkate helps skaters discover spots, share new spots with the community, and keep local scenes updated."
    );
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/profile");
  };

  return (
    <div className="min-h-screen bg-black text-white px-5 py-8 font-sans max-w-lg mx-auto">
      {/* ---- Back ---- */}
      <Link
        href="/profile"
        className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white mb-6"
      >
        ← Back to profile
      </Link>

      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {infoMessage && (
        <div className="mb-4 rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-zinc-300">
          {infoMessage}
        </div>
      )}

      {/* ---- Account ---- */}
      <SettingsSection title="Account">
        <SettingsRow
          icon="👤"
          label="Edit Profile"
          href="/profile/edit?from=settings"
        />
        <SettingsRow
          icon="🔑"
          label="Change Password"
          onClick={() => showComingSoon("Change Password")}
        />
        <SettingsRow
          icon="📧"
          label="Email Address"
          value={user?.email || "Coming soon"}
          onClick={() => {
            if (!user?.email) showComingSoon("Email Address");
          }}
        />
        <SettingsRow icon="🚪" label="Log Out" danger onClick={handleLogout} />
      </SettingsSection>

      {/* ---- Privacy ---- */}
      <SettingsSection title="Privacy">
        <SettingsRow
          icon="👁️"
          label="Profile Visibility"
          onClick={() => showComingSoon("Privacy settings")}
        />
        <SettingsRow
          icon="📍"
          label="Location Sharing"
          onClick={() => showComingSoon("Privacy settings")}
        />
        <SettingsRow
          icon="🚫"
          label="Blocked Users"
          onClick={() => showComingSoon("Blocked Users")}
        />
      </SettingsSection>

      {/* ---- Help / About ---- */}
      <SettingsSection title="Help / About">
        <SettingsRow
          icon="📝"
          label="Send Feedback"
          onClick={showFeedbackPlaceholder}
        />
        <SettingsRow icon="ℹ️" label="About GoSkate" onClick={showAbout} />
      </SettingsSection>

      {/* App version */}
      <p className="text-center text-xs text-zinc-700 mt-8 mb-4">
        GoSkate v0.1.0 — built with 🛹
      </p>
    </div>
  );
}

// ============================================================
// Helper components
// ============================================================

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-1">
        {title}
      </h2>
      <div className="rounded-xl bg-zinc-900 divide-y divide-zinc-800 overflow-hidden">
        {children}
      </div>
    </section>
  );
}

function SettingsRow({
  icon,
  label,
  href,
  value,
  danger,
  onClick,
}: {
  icon: string;
  label: string;
  href?: string;
  value?: string;
  danger?: boolean;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span className="text-lg">{icon}</span>
      <span className={`text-sm ${danger ? "text-red-400" : ""}`}>{label}</span>
      {value ? (
        <span className="ml-auto text-xs text-zinc-500 truncate max-w-[45%] text-right">
          {value}
        </span>
      ) : (
        <span className="ml-auto text-zinc-600 text-sm">›</span>
      )}
    </>
  );

  const classes =
    "flex items-center gap-3 w-full px-4 py-3.5 text-left active:bg-zinc-800 transition-colors";

  if (href) {
    return (
      <Link href={href} className={classes}>
        {inner}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button onClick={onClick} className={classes}>
        {inner}
      </button>
    );
  }

  return (
    <button onClick={() => alert(`${label} — Coming soon`)} className={classes}>
      {inner}
    </button>
  );
}
