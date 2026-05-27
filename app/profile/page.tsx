"use client";

// ============================================================
// Profile Hub — /profile
//
// Two states:
//   Signed out → shows login / signup forms (Supabase Auth).
//   Signed in  → loads the user's profile row from the profiles
//                table and displays it in a UserBannerCard.
//
// Auth is handled entirely by Supabase. The profile row is a
// separate table linked to auth.users by the same user id.
// On first login ensureProfile() creates the row automatically.
// ============================================================

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import { ensureProfile, type Profile } from "@/lib/profilesService";
import UserBannerCard from "@/components/ui/UserBannerCard";

type Mode = "login" | "signup";

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // ---- Auth form state (only used when signed out) ----
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ---- Profile state (only used when signed in) ----
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // When the auth user resolves, load or auto-create their profile row.
  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

    setProfileLoading(true);
    setProfileError(null);

    ensureProfile(user)
      .then(setProfile)
      .catch((err: unknown) => {
        setProfileError(
          err instanceof Error ? err.message : "Could not load profile."
        );
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
              avatar_url: avatarUrl.trim() || null,
            },
          },
        });

        if (signUpError) throw signUpError;

        setMessage(
          "Account created. If email confirmation is enabled in Supabase, check your inbox before logging in."
        );
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        setMessage("Logged in successfully.");
        router.push("/profile");
      }
    } catch (authError) {
      setError(
        authError instanceof Error ? authError.message : "Authentication failed."
      );
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
      setError(
        signOutError instanceof Error
          ? signOutError.message
          : "Could not log out."
      );
    } finally {
      setSaving(false);
    }
  }

  // ---- Auth loading ----
  if (authLoading) {
    return (
      <div className="min-h-screen bg-black px-5 py-8 text-white">
        <div className="mx-auto flex min-h-[70vh] max-w-lg items-center justify-center rounded-3xl border border-white/10 bg-zinc-950/80 p-6 text-sm text-zinc-400 backdrop-blur">
          Loading your account...
        </div>
      </div>
    );
  }

  // ---- Signed out — show auth form ----
  if (!user) {
    return (
      <div className="min-h-screen bg-black px-5 py-8 text-white">
        <div className="mx-auto max-w-lg">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-1 text-sm text-zinc-400 transition-colors hover:text-white"
          >
            ← Back to map
          </Link>

          <div className="rounded-3xl border border-white/10 bg-zinc-950/80 p-5 shadow-2xl backdrop-blur">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              GoSkate Account
            </p>
            <h1 className="mt-2 text-2xl font-bold">Sign in or create an account</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Use Supabase Auth to stay logged in across refreshes. Username and
              avatar image support are stored in your auth metadata.
            </p>

            <div className="mt-5 grid grid-cols-2 rounded-2xl bg-zinc-900 p-1 text-sm">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`rounded-xl px-3 py-2 transition-colors ${
                  mode === "login" ? "bg-white text-black" : "text-zinc-400"
                }`}
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`rounded-xl px-3 py-2 transition-colors ${
                  mode === "signup" ? "bg-white text-black" : "text-zinc-400"
                }`}
              >
                Sign up
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="mt-5 space-y-4">
              <Field
                label="Email"
                value={email}
                onChange={setEmail}
                type="email"
                placeholder="you@example.com"
              />
              <Field
                label="Password"
                value={password}
                onChange={setPassword}
                type="password"
                placeholder="••••••••"
              />

              {mode === "signup" && (
                <>
                  <Field
                    label="Username"
                    value={username}
                    onChange={setUsername}
                    placeholder="your skate name"
                    prefix="@"
                  />
                  <Field
                    label="Profile Image URL"
                    value={avatarUrl}
                    onChange={setAvatarUrl}
                    placeholder="https://..."
                  />
                </>
              )}

              {error && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              )}

              {message && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Working..." : mode === "signup" ? "Create account" : "Log in"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ---- Signed in — show real profile from Supabase profiles table ----
  return (
    <div className="min-h-screen bg-black px-5 py-8 text-white">
      <div className="mx-auto max-w-lg space-y-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-zinc-400 transition-colors hover:text-white"
        >
          ← Back to map
        </Link>

        {/* Profile card loading / error states */}
        {profileLoading && (
          <div className="rounded-3xl border border-white/10 bg-zinc-950/80 p-6 text-sm text-zinc-400 backdrop-blur">
            Loading profile...
          </div>
        )}

        {profileError && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {profileError}
          </div>
        )}

        {/* Real profile card — renders once the profile row is loaded */}
        {profile && (
          <UserBannerCard
            profile={profile}
            onClipsClick={() => alert("Clips coming soon!")}
          />
        )}

        {/* Action buttons */}
        <div className="grid gap-3">
          <Link
            href="/profile/edit"
            className="block w-full rounded-2xl bg-white px-4 py-3 text-center text-sm font-semibold text-black transition-transform active:scale-[0.99]"
          >
            Edit Profile
          </Link>

          <Link
            href="/profile/settings"
            className="block w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            Settings
          </Link>

          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleLogout}
            disabled={saving}
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-400 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Signing out..." : "Log out"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Reusable text input — used by the auth form only
// ============================================================
function Field({
  label,
  value,
  onChange,
  placeholder,
  prefix,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  prefix?: string;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-zinc-500">{label}</span>
      <div className="relative">
        {prefix && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
            {prefix}
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-zinc-500 ${
            prefix ? "pl-8" : ""
          }`}
        />
      </div>
    </label>
  );
}
