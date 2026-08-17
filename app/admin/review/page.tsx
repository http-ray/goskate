"use client";

// ============================================================
// Admin Review Page — moderation interface for pending spots
//
// Access control: checks profiles.is_admin = true via Supabase.
// The is_admin flag is enforced at the DB layer by RLS — only
// rows with is_admin = true can SELECT or UPDATE any-status spots.
//
// Two tabs:
//   - Pending: spots awaiting a first decision.
//   - History: everything already decided (approved/rejected/
//     flagged), most recently reviewed first. The same
//     Approve/Reject/Flag actions work here too, so a past
//     decision can be reversed — nothing about a status is final.
// ============================================================

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import { supabase } from "@/lib/supabase";
import type { SupabaseSpotRow } from "@/types/spot";

interface SpotWithProfile extends SupabaseSpotRow {
  submitter_username?: string;
  submitter_avatar_url?: string;
  reviewer_username?: string;
}

type View = "pending" | "history";

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-success/15 text-success",
  rejected: "bg-danger/15 text-danger",
  flagged: "bg-flag/15 text-flag",
};

export default function AdminReviewPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();

  const [isAdmin, setIsAdmin] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);
  const [view, setView] = useState<View>("pending");
  const [spots, setSpots] = useState<SpotWithProfile[]>([]);
  const [loadingSpots, setLoadingSpots] = useState(false);
  const [actioningSpotId, setActioningSpotId] = useState<string | null>(null);
  const [moderationNote, setModerationNote] = useState("");
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [currentAction, setCurrentAction] = useState<"approve" | "reject" | "flag" | null>(null);
  const [currentSpot, setCurrentSpot] = useState<SpotWithProfile | null>(null);

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

  // ---- Fetch spots for the active tab ----
  useEffect(() => {
    if (!accessChecked || !isAdmin) return;

    fetchSpots(view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessChecked, isAdmin, view]);

  async function fetchSpots(currentView: View) {
    setLoadingSpots(true);
    try {
      const query = supabase.from("spots").select("*");

      const { data: spotRows, error: spotsError } =
        currentView === "pending"
          ? await query.eq("status", "pending").order("created_at", { ascending: false })
          : await query
              .in("status", ["approved", "rejected", "flagged"])
              .order("reviewed_at", { ascending: false, nullsFirst: false });

      if (spotsError) throw spotsError;

      // Fetch submitter + reviewer profiles in one pass
      const userIds = [
        ...new Set(
          (spotRows || [])
            .flatMap((s) => [s.created_by, s.reviewed_by])
            .filter(Boolean)
        ),
      ];
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      const profileById = new Map((profiles || []).map((p) => [p.id, p]));

      const spotsWithProfiles = (spotRows || []).map((spot) => ({
        ...spot,
        submitter_username: profileById.get(spot.created_by)?.username,
        submitter_avatar_url: profileById.get(spot.created_by)?.avatar_url,
        reviewer_username: spot.reviewed_by
          ? profileById.get(spot.reviewed_by)?.username
          : undefined,
      }));

      setSpots(spotsWithProfiles);
    } catch (error) {
      console.error("Failed to fetch spots:", error);
      toast.error("Failed to load spots.");
    } finally {
      setLoadingSpots(false);
    }
  }

  // ---- Handle moderation actions ----
  async function handleAction(
    spotId: string,
    action: "approve" | "reject" | "flag",
    note?: string
  ) {
    if (!user) return;

    setActioningSpotId(spotId);

    try {
      const status: SupabaseSpotRow["status"] =
        action === "approve" ? "approved" : action === "reject" ? "rejected" : "flagged";

      const updateData = {
        status,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        moderation_notes: note || null,
      };

      const { error } = await supabase
        .from("spots")
        .update(updateData)
        .eq("id", spotId);

      if (error) throw error;

      if (view === "pending") {
        // Decided for the first time — it leaves the pending queue.
        setSpots((prev) => prev.filter((s) => s.id !== spotId));
      } else {
        // Already in history — update it in place so a reversed
        // decision is visible immediately without a refetch.
        setSpots((prev) =>
          prev.map((s) =>
            s.id === spotId
              ? {
                  ...s,
                  ...updateData,
                  reviewer_username: user.email?.split("@")[0] || s.reviewer_username,
                }
              : s
          )
        );
      }

      toast.success(`Spot ${action}d successfully!`);
    } catch (error) {
      console.error(`Failed to ${action} spot:`, error);
      toast.error(`Failed to ${action} spot.`);
    } finally {
      setActioningSpotId(null);
      setShowNoteModal(false);
      setModerationNote("");
      setCurrentAction(null);
      setCurrentSpot(null);
    }
  }

  const openNoteModal = (
    spot: SpotWithProfile,
    action: "approve" | "reject" | "flag"
  ) => {
    setCurrentSpot(spot);
    setCurrentAction(action);
    setShowNoteModal(true);
  };

  const submitWithNote = () => {
    if (!currentSpot || !currentAction) return;
    handleAction(currentSpot.id, currentAction, moderationNote);
  };

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
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Admin Review</h1>
              <p className="mt-1 text-sm text-muted">
                {spots.length} {view === "pending" ? "pending" : "reviewed"} spot
                {spots.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => router.push("/admin/feedback")}
                className="rounded-xl border border-line bg-elevated px-4 py-2 text-sm text-ink transition-colors hover:bg-line/40"
              >
                Feedback
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
              onClick={() => setView("pending")}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
                view === "pending" ? "bg-accent text-on-accent" : "text-muted hover:text-ink"
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setView("history")}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
                view === "history" ? "bg-accent text-on-accent" : "text-muted hover:text-ink"
              }`}
            >
              History
            </button>
          </div>
        </div>
      </div>

      {/* Spot list */}
      <div className="mx-auto max-w-7xl px-4 py-8">
        {loadingSpots ? (
          <div className="rounded-2xl border border-line-soft bg-surface px-8 py-12 text-center">
            <p className="text-muted">Loading...</p>
          </div>
        ) : spots.length === 0 ? (
          <div className="rounded-2xl border border-line-soft bg-surface px-8 py-12 text-center">
            <p className="text-muted">
              {view === "pending" ? "No pending spots to review." : "No reviewed spots yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {spots.map((spot) => (
              <div
                key={spot.id}
                className="rounded-2xl border border-line-soft bg-surface p-6"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  {/* Spot details */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start gap-3">
                      {/* Submitter avatar */}
                      {spot.submitter_avatar_url ? (
                        <img
                          src={spot.submitter_avatar_url}
                          alt={spot.submitter_username || "User"}
                          className="h-10 w-10 rounded-full bg-elevated"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-elevated text-sm text-muted">
                          👤
                        </div>
                      )}

                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold">{spot.display_name}</h3>
                          {view === "history" && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                                STATUS_STYLES[spot.status] || "bg-elevated text-faint"
                              }`}
                            >
                              {spot.status}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted">
                          by <span className="text-ink">{spot.submitter_username || "Unknown"}</span>
                          {" • "}
                          {new Date(spot.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                      <div>
                        <span className="text-faint">Type:</span>{" "}
                        <span className="capitalize text-ink">{spot.type}</span>
                      </div>
                      <div>
                        <span className="text-faint">Location:</span>{" "}
                        <span className="text-ink">
                          {spot.latitude.toFixed(4)}, {spot.longitude.toFixed(4)}
                        </span>
                      </div>
                      <div>
                        <span className="text-faint">Source:</span>{" "}
                        <span className="capitalize text-ink">{spot.source}</span>
                      </div>
                      {spot.possible_duplicate && (
                        <div className="col-span-2 md:col-span-1">
                          <span className="rounded-full bg-warning/15 px-2 py-1 text-xs text-warning">
                            ⚠️ Possible Duplicate
                          </span>
                        </div>
                      )}
                    </div>

                    {spot.description && (
                      <div className="rounded-2xl border border-line-soft bg-field p-3">
                        <p className="text-sm text-muted">{spot.description}</p>
                      </div>
                    )}

                    {spot.obstacle_tags && spot.obstacle_tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        <span className="text-sm text-faint">Tags:</span>
                        {spot.obstacle_tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-success/15 px-2 py-1 text-xs text-success"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {spot.area_text && (
                      <div className="text-sm">
                        <span className="text-faint">Area:</span>{" "}
                        <span className="text-ink">{spot.area_text}</span>
                      </div>
                    )}

                    {view === "history" && (spot.reviewed_at || spot.moderation_notes) && (
                      <div className="rounded-2xl border border-line-soft bg-field p-3 text-sm">
                        {spot.reviewed_at && (
                          <p className="text-faint">
                            Reviewed by{" "}
                            <span className="text-ink">{spot.reviewer_username || "an admin"}</span>{" "}
                            on {new Date(spot.reviewed_at).toLocaleString()}
                          </p>
                        )}
                        {spot.moderation_notes && (
                          <p className="mt-1 text-muted">
                            <span className="text-faint">Note:</span> {spot.moderation_notes}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-row gap-2 md:flex-col">
                    <button
                      onClick={() => handleAction(spot.id, "approve")}
                      disabled={actioningSpotId === spot.id || spot.status === "approved"}
                      className="flex-1 rounded-xl bg-success px-4 py-2 text-sm font-semibold text-on-accent transition-colors hover:bg-success/90 disabled:opacity-50 md:flex-none"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => openNoteModal(spot, "reject")}
                      disabled={actioningSpotId === spot.id || spot.status === "rejected"}
                      className="flex-1 rounded-xl border border-danger/30 bg-danger/15 px-4 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger/25 disabled:opacity-50 md:flex-none"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => openNoteModal(spot, "flag")}
                      disabled={actioningSpotId === spot.id || spot.status === "flagged"}
                      className="flex-1 rounded-xl border border-flag/30 bg-flag/15 px-4 py-2 text-sm font-semibold text-flag transition-colors hover:bg-flag/25 disabled:opacity-50 md:flex-none"
                    >
                      Flag
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Moderation note modal */}
      {showNoteModal && currentSpot && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 px-4">
          <div className="w-full max-w-md rounded-2xl border border-line bg-elevated p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-ink">
              {currentAction === "reject" ? "Reject" : "Flag"} Spot
            </h2>
            <p className="mt-2 text-sm text-muted">
              Add a note explaining why this spot is being {currentAction}d.
            </p>

            <textarea
              value={moderationNote}
              onChange={(e) => setModerationNote(e.target.value)}
              placeholder="Enter moderation notes..."
              rows={4}
              className="mt-4 w-full resize-none gs-input"
            />

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  setShowNoteModal(false);
                  setModerationNote("");
                  setCurrentAction(null);
                  setCurrentSpot(null);
                }}
                className="flex-1 gs-btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={submitWithNote}
                className="flex-1 gs-btn-primary"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
