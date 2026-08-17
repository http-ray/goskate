"use client";

// ============================================================
// Admin Feedback Inbox — /admin/feedback
//
// Access control: checks profiles.is_admin = true via Supabase,
// same pattern as /admin/review. The DB layer enforces this too —
// the feedback table's SELECT/UPDATE/DELETE policies only allow
// admins. Feedback can come from signed-out visitors (user_id is
// null in that case — shown as "Anonymous").
// ============================================================

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import { supabase } from "@/lib/supabase";
import { fetchFeedback, setFeedbackStatus, deleteFeedback } from "@/lib/feedbackService";
import type { Feedback, FeedbackStatus } from "@/types/feedback";

interface FeedbackWithProfile extends Feedback {
  submitter_username?: string;
}

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: "New",
  read: "Read",
  focus: "Focus",
  archived: "Archived",
};

const STATUS_STYLES: Record<FeedbackStatus, string> = {
  new: "bg-info/15 text-info",
  read: "bg-elevated text-faint",
  focus: "bg-flag/15 text-flag",
  archived: "bg-elevated text-faint",
};

export default function AdminFeedbackPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();

  const [isAdmin, setIsAdmin] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);
  const [entries, setEntries] = useState<FeedbackWithProfile[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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

    loadFeedback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessChecked, isAdmin]);

  async function loadFeedback() {
    setLoadingEntries(true);
    try {
      const feedback = await fetchFeedback();

      const userIds = [...new Set(feedback.map((f) => f.user_id).filter(Boolean))] as string[];
      const usernameById: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username")
          .in("id", userIds);

        (profiles || []).forEach((p: { id: string; username: string | null }) => {
          if (p.username) usernameById[p.id] = p.username;
        });
      }

      setEntries(
        feedback.map((f) => ({
          ...f,
          submitter_username: f.user_id ? usernameById[f.user_id] : undefined,
        }))
      );
    } catch (error) {
      console.error("Failed to fetch feedback:", error);
      toast.error("Failed to load feedback.");
    } finally {
      setLoadingEntries(false);
    }
  }

  async function handleStatusChange(id: string, status: FeedbackStatus) {
    try {
      await setFeedbackStatus(id, status);
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)));
    } catch (error) {
      console.error("Failed to update feedback status:", error);
      toast.error("Failed to update status.");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteFeedback(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      toast.success("Feedback deleted.");
    } catch (error) {
      console.error("Failed to delete feedback:", error);
      toast.error("Failed to delete feedback.");
    } finally {
      setConfirmDeleteId(null);
    }
  }

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

  const visibleEntries = entries.filter((e) =>
    showArchived ? e.status === "archived" : e.status !== "archived"
  );

  return (
    <div className="min-h-screen bg-base text-ink">
      {/* Header */}
      <div className="border-b border-line bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Feedback Inbox</h1>
              <p className="mt-1 text-sm text-muted">
                {visibleEntries.length} message{visibleEntries.length !== 1 ? "s" : ""}
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

          {/* Tabs */}
          <div className="mt-5 flex gap-1 rounded-xl bg-elevated p-1 w-fit">
            <button
              onClick={() => setShowArchived(false)}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
                !showArchived ? "bg-accent text-on-accent" : "text-muted hover:text-ink"
              }`}
            >
              Inbox
            </button>
            <button
              onClick={() => setShowArchived(true)}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
                showArchived ? "bg-accent text-on-accent" : "text-muted hover:text-ink"
              }`}
            >
              Archived
            </button>
          </div>
        </div>
      </div>

      {/* Feedback list */}
      <div className="mx-auto max-w-3xl px-4 py-8">
        {loadingEntries ? (
          <div className="rounded-2xl border border-line-soft bg-surface px-8 py-12 text-center">
            <p className="text-muted">Loading feedback...</p>
          </div>
        ) : visibleEntries.length === 0 ? (
          <div className="rounded-2xl border border-line-soft bg-surface px-8 py-12 text-center">
            <p className="text-muted">
              {showArchived ? "No archived feedback." : "No feedback yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleEntries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-2xl border border-line-soft bg-surface p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-muted">
                    <span className="text-ink">
                      {entry.submitter_username || "Anonymous"}
                    </span>
                    {" • "}
                    {new Date(entry.created_at).toLocaleString()}
                  </p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[entry.status]}`}
                  >
                    {STATUS_LABELS[entry.status]}
                  </span>
                </div>

                <p className="mt-2 whitespace-pre-wrap text-sm text-ink">
                  {entry.message}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <select
                    value={entry.status}
                    onChange={(e) =>
                      handleStatusChange(entry.id, e.target.value as FeedbackStatus)
                    }
                    className="rounded-xl border border-line-soft bg-field px-3 py-1.5 text-sm text-ink outline-none focus:border-accent/50"
                  >
                    <option value="new">New</option>
                    <option value="read">Read</option>
                    <option value="focus">Focus</option>
                    <option value="archived">Archived</option>
                  </select>

                  {confirmDeleteId === entry.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted">Delete this?</span>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-on-accent hover:bg-danger/90"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-lg border border-line bg-elevated px-3 py-1.5 text-xs text-ink hover:bg-line/40"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(entry.id)}
                      className="ml-auto rounded-xl border border-danger/30 bg-danger/15 px-3 py-1.5 text-xs font-semibold text-danger transition-colors hover:bg-danger/25"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
