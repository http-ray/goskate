// ============================================================
// Settings Page — /profile/settings
//
// Working features: Edit Profile, Change Password, Profile
// Visibility toggle, Send Feedback (in-app), Log Out.
// Location Sharing and Blocked Users remain "coming soon".
// ============================================================

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import { supabase } from "@/lib/supabase";
import { getProfile, updateProfile } from "@/lib/profilesService";

const MIN_PASSWORD_LENGTH = 8;

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();

  // ---- Change password ----
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // ---- Profile visibility ----
  const [isPublic, setIsPublic] = useState<boolean | null>(null);
  const [savingVisibility, setSavingVisibility] = useState(false);

  useEffect(() => {
    if (!user) return;
    getProfile(user.id)
      .then((p) => {
        if (p) setIsPublic(p.is_public);
      })
      .catch(() => {});
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/profile");
  };

  async function handleChangePassword() {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match.");
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password updated.");
      setShowPasswordForm(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update password.");
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleToggleVisibility() {
    if (isPublic === null || !user) return;
    const next = !isPublic;
    setSavingVisibility(true);
    try {
      await updateProfile(user.id, { is_public: next });
      setIsPublic(next);
      toast.success(next ? "Profile is now public." : "Profile is now private.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update visibility.");
    } finally {
      setSavingVisibility(false);
    }
  }

  return (
    <div className="min-h-screen bg-base text-ink px-5 py-8 font-sans max-w-lg mx-auto">
      {/* ---- Back ---- */}
      <Link
        href="/map"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink mb-6"
      >
        ← Back to map
      </Link>

      <h1 className="text-2xl font-bold mb-6">Settings</h1>

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
          onClick={() => setShowPasswordForm((v) => !v)}
        />
        {showPasswordForm && (
          <div className="space-y-3 px-4 py-4">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              autoComplete="new-password"
              className="w-full rounded-xl border border-line-soft bg-field px-4 py-2.5 text-sm text-ink outline-none placeholder:text-faint focus:border-accent/50"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              autoComplete="new-password"
              className="w-full rounded-xl border border-line-soft bg-field px-4 py-2.5 text-sm text-ink outline-none placeholder:text-faint focus:border-accent/50"
            />
            <p className="text-xs text-faint">
              At least {MIN_PASSWORD_LENGTH} characters.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowPasswordForm(false);
                  setNewPassword("");
                  setConfirmPassword("");
                }}
                disabled={savingPassword}
                className="gs-btn-ghost px-4 py-2 text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleChangePassword}
                disabled={savingPassword}
                className="gs-btn-primary px-4 py-2 text-sm disabled:opacity-50"
              >
                {savingPassword ? "Saving…" : "Update Password"}
              </button>
            </div>
          </div>
        )}
        <SettingsRow icon="📧" label="Email Address" value={user?.email || "—"} />
        <SettingsRow icon="🚪" label="Log Out" danger onClick={handleLogout} />
      </SettingsSection>

      {/* ---- Privacy ---- */}
      <SettingsSection title="Privacy">
        {/* Profile visibility toggle */}
        <div className="flex items-center gap-3 px-4 py-3.5">
          <span className="text-lg" aria-hidden="true">
            👁️
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm">Profile Visibility</p>
            <p className="text-xs text-faint">
              {isPublic === null
                ? "Loading…"
                : isPublic
                ? "Public — others can find and follow you"
                : "Private — hidden from other users"}
            </p>
          </div>
          <button
            role="switch"
            aria-checked={isPublic ?? false}
            aria-label="Toggle profile visibility"
            onClick={handleToggleVisibility}
            disabled={isPublic === null || savingVisibility}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
              isPublic ? "bg-success" : "bg-line"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                isPublic ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
        <SettingsRow
          icon="📍"
          label="Location Sharing"
          comingSoon
          onClick={() => toast.info("Location sharing is coming soon.")}
        />
        <SettingsRow
          icon="🚫"
          label="Blocked Users"
          comingSoon
          onClick={() => toast.info("Blocked users is coming soon.")}
        />
      </SettingsSection>

      {/* ---- Help / About ---- */}
      <SettingsSection title="Help / About">
        <SettingsRow icon="📝" label="Send Feedback" href="/profile/feedback" />
        <SettingsRow
          icon="ℹ️"
          label="About GoSkate"
          onClick={() =>
            toast.info(
              "GoSkate helps skaters discover spots, share new spots, and keep local scenes updated."
            )
          }
        />
      </SettingsSection>

      {/* App version */}
      <p className="text-center text-xs text-faint mt-8 mb-4">
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
      <h2 className="text-xs font-semibold text-faint uppercase tracking-wider mb-2 px-1">
        {title}
      </h2>
      <div className="rounded-2xl border border-line-soft bg-surface divide-y divide-line-soft overflow-hidden">
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
  comingSoon,
  external,
  onClick,
}: {
  icon: string;
  label: string;
  href?: string;
  value?: string;
  danger?: boolean;
  comingSoon?: boolean;
  external?: boolean;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span className="text-lg">{icon}</span>
      <span className={`text-sm ${danger ? "text-danger" : ""}`}>{label}</span>
      {value ? (
        <span className="ml-auto text-xs text-faint truncate max-w-[45%] text-right">
          {value}
        </span>
      ) : comingSoon ? (
        <span className="ml-auto rounded-full border border-line bg-elevated px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-faint">
          Soon
        </span>
      ) : (
        <span className="ml-auto text-faint text-sm">›</span>
      )}
    </>
  );

  const classes =
    "flex items-center gap-3 w-full px-4 py-3.5 text-left transition-colors hover:bg-white/5 active:bg-white/10";

  if (href && external) {
    return (
      <a href={href} className={classes}>
        {inner}
      </a>
    );
  }

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

  // No action wired — render an inert row rather than a dead-end dialog.
  return <div className={`${classes} cursor-default`}>{inner}</div>;
}
