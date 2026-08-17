// ============================================================
// Send Feedback — /profile/feedback
//
// Replaces the old mailto: link. Signed-in users write feedback
// here; it's stored in the feedback table and read by admins on
// /admin/feedback. No email client, no backend service needed.
// ============================================================

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import { submitFeedback } from "@/lib/feedbackService";
import { LIMITS } from "@/lib/validation";

export default function FeedbackPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();

  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    if (!user || !message.trim()) return;

    setSubmitting(true);
    try {
      await submitFeedback(user.id, message);
      setSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send feedback.");
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base text-ink">
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-base text-ink px-5 py-8 font-sans max-w-lg mx-auto">
        <Link
          href="/profile/settings"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink mb-6"
        >
          ← Back to settings
        </Link>
        <h1 className="text-2xl font-bold mb-2">Send Feedback</h1>
        <p className="text-sm text-muted">Sign in to send feedback.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base text-ink px-5 py-8 font-sans max-w-lg mx-auto">
      <Link
        href="/profile/settings"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink mb-6"
      >
        ← Back to settings
      </Link>

      <h1 className="text-2xl font-bold mb-2">Send Feedback</h1>

      {sent ? (
        <div className="rounded-2xl border border-line-soft bg-surface px-6 py-10 text-center">
          <p className="text-sm text-ink">Thanks — your feedback was sent.</p>
          <button
            onClick={() => router.push("/profile/settings")}
            className="mt-5 gs-btn-secondary px-6 py-2 text-sm"
          >
            Done
          </button>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted mb-4">
            Bugs, ideas, missing spots — whatever&apos;s on your mind. This
            goes straight to the GoSkate team.
          </p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What's up?"
            rows={8}
            maxLength={LIMITS.feedbackMessage}
            className="w-full resize-none gs-input"
          />
          <p className="mt-1 text-right text-xs text-faint">
            {message.length}/{LIMITS.feedbackMessage}
          </p>
          <button
            onClick={handleSubmit}
            disabled={submitting || !message.trim()}
            className="mt-4 w-full gs-btn-primary py-3 text-sm disabled:opacity-50"
          >
            {submitting ? "Sending…" : "Send Feedback"}
          </button>
        </>
      )}
    </div>
  );
}
