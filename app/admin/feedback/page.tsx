"use client";

// ============================================================
// Admin Feedback Inbox — /admin/feedback
//
// Access control: checks profiles.is_admin = true via Supabase,
// same pattern as /admin/review. The DB layer enforces this too —
// the feedback table's SELECT policy only allows admins to read.
// ============================================================

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import { supabase } from "@/lib/supabase";
import { fetchFeedback } from "@/lib/feedbackService";
import type { Feedback } from "@/types/feedback";

interface FeedbackWithProfile extends Feedback {
  submitter_username?: string;
}

export default function AdminFeedbackPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();

  const [isAdmin, setIsAdmin] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);
  const [entries, setEntries] = useState<FeedbackWithProfile[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // ---- Check admin access via profiles.is_admin ----
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setAccessChecked(true);
      router.push("/profile");
      return;
    }

    (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", user.id)
          .single();

        const admin = data?.is_admin === true;
        setIsAdmin(admin);
        setAccessChecked(true);
        if (!admin) router.push("/map");
      } catch {
        setIsAdmin(false);
        setAccessChecked(true);
        router.push("/map");
      }
    })();
  }, [authLoading, user, router]);

  // ---- Fetch feedback ----
  useEffect(() => {
    if (!accessChecked || !isAdmin) return;

    (async () => {
      setLoadingEntries(true);
      try {
        const feedback = await fetchFeedback();

        const userIds = [...new Set(feedback.map((f) => f.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username")
          .in("id", userIds);

        const usernameById: Record<string, string> = {};
        (profiles || []).forEach((p: { id: string; username: string | null }) => {
          if (p.username) usernameById[p.id] = p.username;
        });

        setEntries(
          feedback.map((f) => ({
            ...f,
            submitter_username: usernameById[f.user_id],
          }))
        );
      } catch (error) {
        console.error("Failed to fetch feedback:", error);
        toast.error("Failed to load feedback.");
      } finally {
        setLoadingEntries(false);
      }
    })();
  }, [accessChecked, isAdmin, toast]);

  if (authLoading || !accessChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-base text-ink">
        Loading...
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null; // Redirect handled in useEffect
  }

  return (
    <div className="min-h-screen bg-base text-ink">
      {/* Header */}
      <div className="border-b border-line bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Feedback Inbox</h1>
              <p className="mt-1 text-sm text-muted">
                {entries.length} message{entries.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => router.push("/admin/review")}
                className="rounded-xl border border-line bg-elevated px-4 py-2 text-sm text-ink transition-colors hover:bg-line/40"
              >
                Review Queue
              </button>
              <button
                onClick={() => router.push("/map")}
                className="rounded-xl border border-line bg-elevated px-4 py-2 text-sm text-ink transition-colors hover:bg-line/40"
              >
                Back to Map
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback list */}
      <div className="mx-auto max-w-3xl px-4 py-8">
        {loadingEntries ? (
          <div className="rounded-2xl border border-line-soft bg-surface px-8 py-12 text-center">
            <p className="text-muted">Loading feedback...</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-2xl border border-line-soft bg-surface px-8 py-12 text-center">
            <p className="text-muted">No feedback yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-2xl border border-line-soft bg-surface p-6"
              >
                <p className="text-sm text-muted">
                  <span className="text-ink">
                    {entry.submitter_username || "Unknown"}
                  </span>
                  {" • "}
                  {new Date(entry.created_at).toLocaleString()}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-ink">
                  {entry.message}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
