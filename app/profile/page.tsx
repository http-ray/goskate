"use client";

// ============================================================
// Profile Hub — /profile
//
// Signed out → login / signup forms.
// Signed in  → profile card, follow counts, clips, nav buttons.
// ============================================================

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import { ensureProfile, type Profile } from "@/lib/profilesService";
import { getFollowCounts } from "@/lib/followsService";
import { getClipsForUser } from "@/lib/clipsService";
import { setSeenFollowerCount } from "@/lib/notificationService";
import UserBannerCard from "@/components/ui/UserBannerCard";
import ClipCard from "@/components/ui/ClipCard";
import AddClipForm from "@/components/ui/AddClipForm";
import type { ProfileClip, FollowCounts } from "@/types/social";

type Mode = "login" | "signup";

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // ---- Auth form state (signed-out only) ----
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ---- Profile state (signed-in) ----
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // ---- Social state ----
  const [followCounts, setFollowCounts] = useState<FollowCounts>({ followers: 0, following: 0 });
  const [clips, setClips] = useState<ProfileClip[]>([]);
  const [showAddClip, setShowAddClip] = useState(false);

  useEffect(() => {
    if (!user) { setProfile(null); return; }

    setProfileLoading(true);
    setProfileError(null);

    ensureProfile(user)
      .then(async (p) => {
        setProfile(p);
        const [counts, userClips] = await Promise.all([
          getFollowCounts(p.id),
          getClipsForUser(p.id),
        ]);
        setFollowCounts(counts);
        setClips(userClips);
        // Mark current follower count as seen so the map badge clears
        setSeenFollowerCount(p.id, counts.followers);
      })
      .catch((err: unknown) => {
        setProfileError(err instanceof Error ? err.message : "Could not load profile.");
      })
      .finally(() => setProfileLoading(false));
  }, [user]);

  async function handleAuthSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setSaving(true);

    try {
      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username.trim() || email.split("@")[0],
            },
          },
        });
        if (signUpError) throw signUpError;
        setMessage(
          "Account created. If email confirmation is enabled in Supabase, check your inbox before logging in."
        );
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        setMessage("Logged in successfully.");
        router.push("/profile");
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Authentication failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    setError(null);
    setSaving(true);
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      router.push("/");
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : "Could not log out.");
    } finally {
      setSaving(false);
    }
  }

  function handleClipAdded(clip: ProfileClip) {
    setClips((prev) => [clip, ...prev]);
    setShowAddClip(false);
  }

  async function handleDeleteClip(clip: ProfileClip) {
    if (!confirm(`Delete "${clip.title ?? "this clip"}"?`)) return;
    try {
      const { deleteClip } = await import("@/lib/clipsService");
      await deleteClip(clip.id);
      setClips((prev) => prev.filter((c) => c.id !== clip.id));
    } catch {
      // Silent — UI already unchanged
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-base px-5 py-8 text-ink">
        <div className="mx-auto flex min-h-[70vh] max-w-lg items-center justify-center rounded-2xl border border-line bg-surface p-6 text-sm text-muted">
          Loading your account...
        </div>
      </div>
    );
  }

  // ---- Signed out — auth form ----
  if (!user) {
    return (
      <div className="min-h-screen bg-base px-5 py-8 text-ink">
        <div className="mx-auto max-w-lg">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink"
          >
            ← Back to map
          </Link>

          <div className="rounded-2xl border border-line bg-surface p-5 shadow-2xl">
            <p className="text-xs uppercase tracking-[0.2em] text-faint">GoSkate Account</p>
            <h1 className="mt-2 text-2xl font-bold">Sign in or create an account</h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              Save spots, post clips, and follow other skaters.
            </p>

            <div className="mt-5 grid grid-cols-2 rounded-xl bg-field p-1 text-sm">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`rounded-xl px-3 py-2 transition-colors ${
                  mode === "login" ? "bg-accent text-on-accent" : "text-muted"
                }`}
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`rounded-xl px-3 py-2 transition-colors ${
                  mode === "signup" ? "bg-accent text-on-accent" : "text-muted"
                }`}
              >
                Sign up
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="mt-5 space-y-4">
              <Field label="Email" value={email} onChange={setEmail} type="email" placeholder="you@example.com" />
              <Field label="Password" value={password} onChange={setPassword} type="password" placeholder="••••••••" />

              {mode === "signup" && (
                <Field label="Username" value={username} onChange={setUsername} placeholder="your skate name" prefix="@" />
              )}

              {error && (
                <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {error}
                </div>
              )}
              {message && (
                <div className="rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full gs-btn-primary disabled:opacity-60"
              >
                {saving ? "Working..." : mode === "signup" ? "Create account" : "Log in"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ---- Signed in ----
  return (
    <div className="min-h-screen bg-base px-5 py-8 text-ink">
      <div className="mx-auto max-w-lg space-y-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink"
        >
          ← Back to map
        </Link>

        {profileLoading && (
          <div className="rounded-2xl border border-line bg-surface p-6 text-sm text-muted">
            Loading profile...
          </div>
        )}

        {profileError && (
          <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {profileError}
          </div>
        )}

        {profile && (
          <>
            <UserBannerCard profile={profile} followCounts={followCounts} />

            {/* Follow / connections row */}
            <div className="flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3">
              <Link href="/profile/friends" className="text-sm text-muted hover:text-ink">
                <span className="font-semibold text-ink">{followCounts.following}</span> Following
              </Link>
              <div className="h-4 w-px bg-line" />
              <Link href="/profile/friends" className="text-sm text-muted hover:text-ink">
                <span className="font-semibold text-ink">{followCounts.followers}</span> Followers
              </Link>
              <div className="h-4 w-px bg-line" />
              <Link href="/users/search" className="text-sm text-muted hover:text-ink">
                Find skaters →
              </Link>
            </div>

            {/* Action buttons */}
            <div className="grid gap-3">
              <Link href="/profile/edit?from=profile" className="block w-full gs-btn-primary text-center">
                Edit Profile
              </Link>
              <Link href="/profile/settings" className="block w-full gs-btn-secondary text-center">
                Settings
              </Link>
              {error && (
                <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {error}
                </div>
              )}
              <button
                type="button"
                onClick={handleLogout}
                disabled={saving}
                className="w-full gs-btn-secondary text-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Signing out..." : "Log out"}
              </button>
            </div>

            {/* Clips section */}
            <div className="pt-2">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
                  My Clips
                </h2>
                <button
                  onClick={() => setShowAddClip((v) => !v)}
                  className="text-xs text-muted underline-offset-2 hover:text-ink hover:underline"
                >
                  {showAddClip ? "Cancel" : "+ Add clip"}
                </button>
              </div>

              {showAddClip && (
                <div className="mb-4">
                  <AddClipForm userId={profile.id} onClipAdded={handleClipAdded} />
                </div>
              )}

              {clips.length === 0 && !showAddClip ? (
                <p className="text-sm text-muted">No clips yet. Add your first one!</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {clips.map((clip) => (
                    <ClipCard key={clip.id} clip={clip} onDelete={handleDeleteClip} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, prefix, type = "text",
}: {
  label: string; value: string; onChange: (value: string) => void;
  placeholder?: string; prefix?: string; type?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-faint">{label}</span>
      <div className="relative">
        {prefix && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-faint">{prefix}</span>
        )}
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={`gs-input ${prefix ? "pl-8" : ""}`}
        />
      </div>
    </label>
  );
}
