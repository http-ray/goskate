"use client";

// ============================================================
// Reset Password — /profile/reset-password
//
// Landing page for the "Forgot password?" email link. Supabase's
// client parses the recovery token out of the URL automatically
// (detectSessionInUrl in lib/supabase.ts) and establishes a
// session — at that point useAuth().user is populated and this
// page just needs to call updateUser({ password }) to finish it.
// ============================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabase";

const MIN_PASSWORD_LENGTH = 8;

export default function ResetPasswordPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update password.");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base text-ink">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base px-5 py-8 text-ink">
      <div className="mx-auto max-w-lg">
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-2xl">
          {!user ? (
            <>
              <h1 className="text-2xl font-bold">This link is invalid or has expired</h1>
              <p className="mt-2 text-sm leading-6 text-muted">
                Password reset links only work once and expire after a while.
                Request a new one from the login page.
              </p>
              <Link href="/profile" className="mt-5 block w-full gs-btn-primary text-center">
                Back to login
              </Link>
            </>
          ) : done ? (
            <>
              <h1 className="text-2xl font-bold">Password updated</h1>
              <p className="mt-2 text-sm leading-6 text-muted">
                You&apos;re all set — you can head back to your profile now.
              </p>
              <button
                onClick={() => router.push("/profile")}
                className="mt-5 w-full gs-btn-primary"
              >
                Go to profile
              </button>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold">Set a new password</h1>
              <p className="mt-2 text-sm leading-6 text-muted">
                Choose a new password for your account.
              </p>

              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-faint">New password</span>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="gs-input"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-faint">Confirm new password</span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="gs-input"
                  />
                </label>

                {error && (
                  <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full gs-btn-primary disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Update password"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
