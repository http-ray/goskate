"use client";

// ============================================================
// Profile Hub — /profile
//
// This page is the simple auth entry point for V1.
// If the user is signed out, it shows sign up / log in forms.
// If the user is signed in, it shows a lightweight profile card
// with editable username and avatar URL stored in Supabase auth
// metadata.
// ============================================================

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabase";

type Mode = "login" | "signup";

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentUsername = useMemo(() => {
    const metadataUsername = user?.user_metadata?.username;
    if (typeof metadataUsername === "string" && metadataUsername.trim()) {
      return metadataUsername.trim();
    }

    if (user?.email) {
      return user.email.split("@")[0];
    }

    return "GoSkater";
  }, [user]);

  const currentAvatarUrl = useMemo(() => {
    const metadataAvatar = user?.user_metadata?.avatar_url;
    return typeof metadataAvatar === "string" ? metadataAvatar : "";
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const metadataUsername = user.user_metadata?.username;
    const metadataAvatar = user.user_metadata?.avatar_url;

    setUsername(
      typeof metadataUsername === "string" ? metadataUsername : currentUsername
    );
    setAvatarUrl(typeof metadataAvatar === "string" ? metadataAvatar : "");
    setEmail(user.email ?? "");
  }, [currentUsername, user]);

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

  async function handleSaveProfile() {
    setError(null);
    setMessage(null);
    setSaving(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          username: username.trim() || currentUsername,
          avatar_url: avatarUrl.trim() || null,
        },
      });

      if (updateError) throw updateError;

      setMessage("Profile updated.");
    } catch (updateProfileError) {
      setError(
        updateProfileError instanceof Error
          ? updateProfileError.message
          : "Could not update profile."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    setError(null);
    setMessage(null);
    setSaving(true);

    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      router.push("/");
    } catch (signOutError) {
      setError(
        signOutError instanceof Error ? signOutError.message : "Could not log out."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black px-5 py-8 text-white">
        <div className="mx-auto flex min-h-[70vh] max-w-lg items-center justify-center rounded-3xl border border-white/10 bg-zinc-950/80 p-6 text-sm text-zinc-400 backdrop-blur">
          Loading your account...
        </div>
      </div>
    );
  }

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

  return (
    <div className="min-h-screen bg-black px-5 py-8 text-white">
      <div className="mx-auto max-w-lg">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1 text-sm text-zinc-400 transition-colors hover:text-white"
        >
          ← Back to map
        </Link>

        <div className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/80 shadow-2xl backdrop-blur">
          <div className="bg-gradient-to-br from-zinc-900 via-zinc-950 to-black px-5 py-6">
            <div className="flex items-center gap-4">
              {currentAvatarUrl ? (
                // Use the user's image when available.
                <img
                  src={currentAvatarUrl}
                  alt="Profile image"
                  className="h-20 w-20 rounded-full border border-white/10 object-cover"
                />
              ) : (
                // Placeholder image style: simple avatar circle with an initial.
                <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-zinc-800 text-3xl font-bold text-zinc-300">
                  {currentUsername[0]?.toUpperCase() ?? "G"}
                </div>
              )}

              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Signed in
                </p>
                <h1 className="truncate text-2xl font-bold">{currentUsername}</h1>
                <p className="truncate text-sm text-zinc-400">{user.email}</p>
              </div>
            </div>
          </div>

          <div className="space-y-5 px-5 py-5">
            <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4">
              <p className="text-sm font-semibold">Profile details</p>
              <p className="mt-1 text-sm leading-6 text-zinc-400">
                Username and avatar image live in Supabase Auth metadata for now.
                That keeps the auth flow simple until a dedicated profiles table
                is needed.
              </p>
            </div>

            <div className="space-y-4">
              <Field
                label="Username"
                value={username}
                onChange={setUsername}
                prefix="@"
              />
              <Field
                label="Profile Image URL"
                value={avatarUrl}
                onChange={setAvatarUrl}
                placeholder="https://..."
              />
            </div>

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

            <div className="grid gap-3">
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={saving}
                className="w-full rounded-2xl bg-green-500 px-4 py-3 text-sm font-semibold text-black transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save profile"}
              </button>

              <button
                type="button"
                onClick={handleLogout}
                disabled={saving}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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
