// ============================================================
// Settings Page — /profile/settings
//
// Placeholder settings grouped into logical sections.
// Each row is tappable but just shows an alert for now.
// Sections: Account, Notifications, Privacy, Map Preferences,
//           Appearance, Help / About.
// ============================================================

"use client";

import Link from "next/link";

export default function SettingsPage() {
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

      {/* ---- Account ---- */}
      <SettingsSection title="Account">
        <SettingsRow icon="👤" label="Edit Profile" href="/profile/edit" />
        <SettingsRow icon="🔑" label="Change Password" />
        <SettingsRow icon="📧" label="Email Address" />
        <SettingsRow icon="🚪" label="Log Out" danger />
      </SettingsSection>

      {/* ---- Notifications ---- */}
      <SettingsSection title="Notifications">
        <SettingsRow icon="🔔" label="Push Notifications" />
        <SettingsRow icon="📬" label="Email Notifications" />
        <SettingsRow icon="🛹" label="Friend Activity Alerts" />
      </SettingsSection>

      {/* ---- Privacy ---- */}
      <SettingsSection title="Privacy">
        <SettingsRow icon="👁️" label="Profile Visibility" />
        <SettingsRow icon="📍" label="Location Sharing" />
        <SettingsRow icon="🚫" label="Blocked Users" />
      </SettingsSection>

      {/* ---- Map Preferences ---- */}
      <SettingsSection title="Map Preferences">
        <SettingsRow icon="🗺️" label="Default Map Style" />
        <SettingsRow icon="📏" label="Distance Units" />
        <SettingsRow icon="📌" label="Show Only Favorites" />
      </SettingsSection>

      {/* ---- Appearance ---- */}
      <SettingsSection title="Appearance">
        <SettingsRow icon="🌙" label="Dark Mode" />
        <SettingsRow icon="🎨" label="Accent Color" />
      </SettingsSection>

      {/* ---- Help / About ---- */}
      <SettingsSection title="Help / About">
        <SettingsRow icon="❓" label="FAQ & Support" />
        <SettingsRow icon="📝" label="Send Feedback" />
        <SettingsRow icon="ℹ️" label="About GoSkate" />
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
  danger,
}: {
  icon: string;
  label: string;
  href?: string;
  danger?: boolean;
}) {
  // If we have a real href, use a link; otherwise a button with a placeholder alert
  const inner = (
    <>
      <span className="text-lg">{icon}</span>
      <span className={`text-sm ${danger ? "text-red-400" : ""}`}>{label}</span>
      <span className="ml-auto text-zinc-600 text-sm">›</span>
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

  return (
    <button
      onClick={() => alert(`${label} — coming soon!`)}
      className={classes}
    >
      {inner}
    </button>
  );
}
