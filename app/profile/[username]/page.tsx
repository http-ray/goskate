"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

import { getProfileByUsername, type Profile } from "@/lib/profilesService";
import { getFollowCounts, getFollowStatus, followUser, unfollowUser } from "@/lib/followsService";
import { getClipsForUser } from "@/lib/clipsService";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import ClipCard from "@/components/ui/ClipCard";
import type { ProfileClip, FollowCounts } from "@/types/social";

export default function PublicProfilePage() {
  const params = useParams();
  const username = typeof params.username === "string" ? params.username : "";
  const { user } = useAuth();
  const toast = useToast();

  const [profile, setProfile] = useState<Profile | null | "not_found" | "private">(null);
  const [followCounts, setFollowCounts] = useState<FollowCounts>({ followers: 0, following: 0 });
  const [isFollowing, setIsFollowing] = useState(false);
  const [clips, setClips] = useState<ProfileClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);

  const isOwnProfile =
    user && profile && profile !== "not_found" && profile !== "private"
      ? user.id === (profile as Profile).id
      : false;

  useEffect(() => {
    if (!username) return;
    setLoading(true);

    getProfileByUsername(username)
      .then(async (found) => {
        if (!found) {
          setProfile("not_found");
          return;
        }

        setProfile(found);

        const [counts, userClips] = await Promise.all([
          getFollowCounts(found.id),
          getClipsForUser(found.id),
        ]);
        setFollowCounts(counts);
        setClips(userClips);

        if (user && user.id !== found.id) {
          const status = await getFollowStatus(found.id);
          setIsFollowing(status);
        }
      })
      .catch(() => setProfile("not_found"))
      .finally(() => setLoading(false));
  }, [username, user]);

  async function handleFollowToggle() {
    if (!profile || profile === "not_found" || profile === "private") return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await unfollowUser((profile as Profile).id);
        setIsFollowing(false);
        setFollowCounts((prev) => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));
      } else {
        await followUser((profile as Profile).id);
        setIsFollowing(true);
        setFollowCounts((prev) => ({ ...prev, followers: prev.followers + 1 }));
      }
    } catch {
      toast.error("Couldn't update follow. Please try again.");
    } finally {
      setFollowLoading(false);
    }
  }

  // ---- Loading ----
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base text-sm text-muted">
        Loading profile...
      </div>
    );
  }

  // ---- Not found / private ----
  if (profile === "not_found" || profile === "private") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-base px-6 text-ink">
        <p className="text-lg font-semibold">
          {profile === "private" ? "This profile is private." : "Profile not found"}
        </p>
        {profile === "not_found" && (
          <p className="text-sm text-muted">
            @{username} doesn&apos;t exist or their profile is private.
          </p>
        )}
        <Link href="/map" className="mt-2 text-sm text-muted underline-offset-2 hover:underline">
          ← Back to map
        </Link>
      </div>
    );
  }

  const p = profile as Profile;
  const displayName = p.display_name || p.username || "GoSkater";
  const initials = displayName[0]?.toUpperCase() ?? "G";

  return (
    <div className="min-h-screen overflow-x-hidden bg-base text-ink">

      {/* ============================================================
          Banner — always full viewport width.
          Taller on desktop (md:h-52) for a more expansive feel.
          ============================================================ */}
      <div className="relative">
        {p.banner_url ? (
          <img
            src={p.banner_url}
            alt="Profile banner"
            className="h-36 w-full object-cover md:h-52"
          />
        ) : (
          <div className="h-36 w-full bg-gradient-to-br from-elevated to-surface md:h-52" />
        )}

        {/* Back button — top-left of the banner */}
        <Link
          href="/map"
          className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-sm text-white backdrop-blur-sm md:left-6 md:top-4"
        >
          ←
        </Link>
      </div>

      {/* ============================================================
          Profile body — responsive centered container.
          Mobile:  max-w-xl  (576px), px-4 (16px sides)
          Desktop: max-w-3xl (768px), px-8 (32px sides)
          ============================================================ */}
      <div className="mx-auto w-full max-w-xl px-4 md:max-w-3xl md:px-8">

        {/* ---- Avatar + action button row --------------------------------
            The negative margin pulls the row up so the avatar straddles
            the banner/content boundary.

            Mobile:  -mt-10 → avatar (h-20 = 80px) starts 40px above
                     banner bottom, ends 40px below.
                     mb-4 gap → name starts ~56px below banner bottom.

            Desktop: md:-mt-14 → avatar (md:h-28 = 112px) starts 56px
                     above banner bottom, ends 56px below.
                     md:mb-5 gap → name starts ~76px below banner bottom.
        ---------------------------------------------------------------- */}
        <div className="mb-4 mt-5 flex items-center justify-between gap-4 md:mb-5 md:mt-8">

          {/* Avatar */}
          <div className="shrink-0">
            {p.avatar_url ? (
              <img
                src={p.avatar_url}
                alt={displayName}
                className="h-20 w-20 rounded-full border-4 border-base object-cover md:h-28 md:w-28"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-base bg-elevated text-2xl font-bold md:h-28 md:w-28 md:text-3xl">
                {initials}
              </div>
            )}
          </div>

          {/* Action button */}
          <div>
            {isOwnProfile ? (
              <Link
                href="/profile/edit"
                className="inline-block rounded-2xl border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-muted md:px-5 md:py-2.5 md:text-base"
              >
                Edit Profile
              </Link>
            ) : user ? (
              <button
                onClick={handleFollowToggle}
                disabled={followLoading}
                className={`rounded-2xl px-5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 md:px-6 md:py-2.5 md:text-base ${
                  isFollowing
                    ? "border border-line text-muted hover:border-danger/40 hover:text-danger"
                    : "bg-accent text-on-accent hover:bg-accent-press"
                }`}
              >
                {followLoading ? "..." : isFollowing ? "Following" : "Follow"}
              </button>
            ) : (
              <Link
                href="/profile"
                className="inline-block rounded-2xl bg-accent px-5 py-2 text-sm font-semibold text-on-accent hover:bg-accent-press md:px-6 md:py-2.5 md:text-base"
              >
                Sign in to Follow
              </Link>
            )}
          </div>
        </div>

        {/* ---- Display name + handle ---- */}
        <h1 className="break-words text-xl font-bold leading-tight md:text-2xl">
          {displayName}
        </h1>
        {p.username && (
          <p className="mb-2 break-all text-sm text-muted md:text-base">
            @{p.username}
          </p>
        )}

        {/* ---- Follow counts ---- */}
        <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted md:mb-4 md:gap-x-8 md:text-base">
          <span>
            <span className="font-bold text-ink">{followCounts.followers}</span>{" "}
            Followers
          </span>
          <span>
            <span className="font-bold text-ink">{followCounts.following}</span>{" "}
            Following
          </span>
        </div>

        {/* ---- Stats pills ---- */}
        {(p.stance || p.local_park || p.parks_visited_count > 0) && (
          <div className="mb-3 flex flex-wrap gap-2 md:mb-5">
            {p.stance && (
              <span className="rounded-full border border-line-soft bg-surface px-3 py-1 text-xs capitalize text-muted md:text-sm">
                {p.stance}
              </span>
            )}
            {p.local_park && (
              <span className="max-w-[200px] truncate rounded-full border border-line-soft bg-surface px-3 py-1 text-xs text-muted md:max-w-none md:text-sm">
                📍 {p.local_park}
              </span>
            )}
            {p.parks_visited_count > 0 && (
              <span className="rounded-full border border-line-soft bg-surface px-3 py-1 text-xs text-muted md:text-sm">
                {p.parks_visited_count} parks visited
              </span>
            )}
          </div>
        )}

        {/* ---- Bio ---- */}
        {p.bio && (
          <p className="mb-5 break-words text-sm leading-relaxed text-muted md:mb-6 md:text-base">
            {p.bio}
          </p>
        )}

        {/* ---- Clips section ---- */}
        <div className="mb-12">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-faint md:mb-4 md:text-sm">
            Clips
          </h2>
          {clips.length === 0 ? (
            <p className="text-sm text-faint">No clips yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4">
              {clips.map((clip) => (
                <ClipCard key={clip.id} clip={clip} />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
