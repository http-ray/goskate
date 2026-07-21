"use client";

// ============================================================
// Admin Review Page — moderation interface for pending spots
//
// Access control: checks profiles.is_admin = true via Supabase.
// The is_admin flag is enforced at the DB layer by RLS — only
// rows with is_admin = true can SELECT or UPDATE pending spots.
//
// Features:
//   - List pending spots with submitter details
//   - Approve, reject, or flag spots
//   - Add moderation notes
// ============================================================

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import type { SupabaseSpotRow } from "@/types/spot";

interface PendingSpotWithProfile extends SupabaseSpotRow {
  submitter_username?: string;
  submitter_avatar_url?: string;
}

export default function AdminReviewPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [isAdmin, setIsAdmin] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);
  const [pendingSpots, setPendingSpots] = useState<PendingSpotWithProfile[]>([]);
  const [actioningSpotId, setActioningSpotId] = useState<string | null>(null);
  const [moderationNote, setModerationNote] = useState("");
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [currentAction, setCurrentAction] = useState<"approve" | "reject" | "flag" | null>(null);
  const [currentSpot, setCurrentSpot] = useState<PendingSpotWithProfile | null>(null);

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

  // ---- Fetch pending spots ----
  useEffect(() => {
    if (!accessChecked || !isAdmin) return;

    fetchPendingSpots();
  }, [accessChecked, isAdmin]);

  async function fetchPendingSpots() {
    try {
      const { data: spots, error: spotsError } = await supabase
        .from("spots")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (spotsError) throw spotsError;

      // Fetch submitter profiles
      const userIds = spots?.map((s) => s.created_by).filter(Boolean) || [];
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // Merge profiles into spots
      const spotsWithProfiles = spots?.map((spot) => {
        const profile = profiles?.find((p) => p.id === spot.created_by);
        return {
          ...spot,
          submitter_username: profile?.username,
          submitter_avatar_url: profile?.avatar_url,
        };
      });

      setPendingSpots(spotsWithProfiles || []);
    } catch (error) {
      console.error("Failed to fetch pending spots:", error);
      alert("Failed to load pending spots.");
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
      const updateData: Record<string, unknown> = {
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        moderation_notes: note || null,
      };

      if (action === "approve") {
        updateData.status = "approved";
      } else if (action === "reject") {
        updateData.status = "rejected";
      } else if (action === "flag") {
        updateData.status = "flagged";
      }

      const { error } = await supabase
        .from("spots")
        .update(updateData)
        .eq("id", spotId);

      if (error) throw error;

      // Remove from pending list
      setPendingSpots((prev) => prev.filter((s) => s.id !== spotId));

      alert(`Spot ${action}d successfully!`);
    } catch (error) {
      console.error(`Failed to ${action} spot:`, error);
      alert(`Failed to ${action} spot.`);
    } finally {
      setActioningSpotId(null);
      setShowNoteModal(false);
      setModerationNote("");
      setCurrentAction(null);
      setCurrentSpot(null);
    }
  }

  const openNoteModal = (
    spot: PendingSpotWithProfile,
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
                {pendingSpots.length} pending spot{pendingSpots.length !== 1 ? "s" : ""}
              </p>
            </div>
            <button
              onClick={() => router.push("/map")}
              className="rounded-xl border border-line bg-elevated px-4 py-2 text-sm text-ink transition-colors hover:bg-line/40"
            >
              Back to Map
            </button>
          </div>
        </div>
      </div>

      {/* Pending spots list */}
      <div className="mx-auto max-w-7xl px-4 py-8">
        {pendingSpots.length === 0 ? (
          <div className="rounded-2xl border border-line-soft bg-surface px-8 py-12 text-center">
            <p className="text-muted">No pending spots to review.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingSpots.map((spot) => (
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
                        <h3 className="text-lg font-semibold">{spot.display_name}</h3>
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
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-row gap-2 md:flex-col">
                    <button
                      onClick={() => handleAction(spot.id, "approve")}
                      disabled={actioningSpotId === spot.id}
                      className="flex-1 rounded-xl bg-success px-4 py-2 text-sm font-semibold text-on-accent transition-colors hover:bg-success/90 disabled:opacity-50 md:flex-none"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => openNoteModal(spot, "reject")}
                      disabled={actioningSpotId === spot.id}
                      className="flex-1 rounded-xl border border-danger/30 bg-danger/15 px-4 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger/25 disabled:opacity-50 md:flex-none"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => openNoteModal(spot, "flag")}
                      disabled={actioningSpotId === spot.id}
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 px-4-sm">
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
