"use client";

// ============================================================
// ProfileCard — compact skater profile card used in search
// results, followers/following lists, and anywhere a user
// appears in a list context.
// ============================================================

import Link from "next/link";
import { useState } from "react";
import type { Profile } from "@/lib/profilesService";
import { followUser, unfollowUser } from "@/lib/followsService";

type Props = {
  profile: Profile;
  // Whether the viewing user already follows this profile
  isFollowing?: boolean;
  // If true, show the Follow button. Pass false when viewing own profile list.
  showFollowButton?: boolean;
  // Called after a successful follow/unfollow so parent can update state
  onFollowChange?: (profileId: string, nowFollowing: boolean) => void;
};

export default function ProfileCard({
  profile,
  isFollowing = false,
  showFollowButton = true,
  onFollowChange,
}: Props) {
  const [following, setFollowing] = useState(isFollowing);
  const [loading, setLoading] = useState(false);

  const displayHandle = profile.username ? `@${profile.username}` : null;
  const displayName = profile.display_name || profile.username || "GoSkater";
  const initials = displayName[0]?.toUpperCase() ?? "G";

  async function handleFollowToggle(e: React.MouseEvent) {
    e.preventDefault(); // don't navigate via the Link wrapper
    if (loading) return;
    setLoading(true);
    try {
      if (following) {
        await unfollowUser(profile.id);
        setFollowing(false);
        onFollowChange?.(profile.id, false);
      } else {
        await followUser(profile.id);
        setFollowing(true);
        onFollowChange?.(profile.id, true);
      }
    } catch {
      // Silently revert — user may not be signed in
    } finally {
      setLoading(false);
    }
  }

  const profileHref = profile.username ? `/profile/${profile.username}` : "#";

  return (
    <Link
      href={profileHref}
      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-zinc-900/60 px-4 py-3 transition-colors hover:border-zinc-600 hover:bg-zinc-900"
    >
      {/* Avatar */}
      {profile.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt={displayName}
          className="h-11 w-11 shrink-0 rounded-full border border-white/10 object-cover"
        />
      ) : (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-zinc-700 text-lg font-bold text-white">
          {initials}
        </div>
      )}

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{displayName}</p>
        {displayHandle && (
          <p className="truncate text-xs text-zinc-400">{displayHandle}</p>
        )}
        <div className="mt-0.5 flex flex-wrap gap-2">
          {profile.stance && (
            <span className="text-xs text-zinc-500">{profile.stance}</span>
          )}
          {profile.local_park && (
            <span className="truncate text-xs text-zinc-500">
              📍 {profile.local_park}
            </span>
          )}
        </div>
      </div>

      {/* Follow button */}
      {showFollowButton && (
        <button
          onClick={handleFollowToggle}
          disabled={loading}
          className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            following
              ? "border border-white/20 text-zinc-300 hover:border-red-500/40 hover:text-red-400"
              : "bg-white text-black hover:bg-zinc-200"
          }`}
        >
          {loading ? "..." : following ? "Following" : "Follow"}
        </button>
      )}
    </Link>
  );
}
