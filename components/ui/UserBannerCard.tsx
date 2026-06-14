"use client";

// ============================================================
// UserBannerCard
//
// A reusable profile card showing a user's banner image,
// avatar, name, and skate stats.
//
// Used on:
//   - /profile (logged-in user's own card)
//   - Future: map spot popups showing nearby skaters
//   - Future: friend search results
//
// Props:
//   profile       — a Profile object from profilesService
//   onClipsClick  — optional; renders a "View Clips" button
//                   when provided (leave undefined to hide it)
// ============================================================

import type { Profile } from "@/lib/profilesService";
import type { FollowCounts } from "@/types/social";

type UserBannerCardProps = {
  profile: Profile;
  /** Optional — follower/following counts to display on the card. */
  followCounts?: FollowCounts;
  /** Optional — show a "View Clips" button that calls this when tapped. */
  onClipsClick?: () => void;
};

export default function UserBannerCard({
  profile,
  followCounts,
  onClipsClick,
}: UserBannerCardProps) {
  // Prefer display_name, fall back to username, then a generic placeholder
  const displayName = profile.display_name || profile.username || "GoSkater";
  const handle = profile.username ? `@${profile.username}` : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">

      {/* ============================================================
          Banner
          Uses banner_url when available; falls back to a gradient.
          ============================================================ */}
      <div
        className="relative h-28 w-full bg-gradient-to-br from-accent/25 via-elevated to-base"
        style={
          profile.banner_url
            ? {
                backgroundImage: `url(${profile.banner_url})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        {/* Avatar — positioned so it overlaps the bottom edge of the banner */}
        <div className="absolute -bottom-10 left-5">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={`${displayName}'s avatar`}
              className="h-20 w-20 rounded-full border-4 border-surface object-cover"
            />
          ) : (
            // Initial letter fallback
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-surface bg-elevated text-3xl font-bold text-ink">
              {displayName[0]?.toUpperCase() ?? "G"}
            </div>
          )}
        </div>
      </div>

      {/* ============================================================
          Name, handle, bio, stats
          pt-12 gives room for the avatar that overlaps the banner.
          ============================================================ */}
      <div className="px-5 pb-5 pt-12">

        {/* Name row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold leading-tight">
              {displayName}
            </h2>
            {handle && (
              <p className="text-sm text-faint">{handle}</p>
            )}
          </div>

          {/* Private badge — shown when profile.is_public is false */}
          {!profile.is_public && (
            <span className="shrink-0 rounded-full border border-line px-2.5 py-0.5 text-xs text-faint">
              Private
            </span>
          )}
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="mt-2 text-sm leading-6 text-muted">{profile.bio}</p>
        )}

        {/* ============================================================
            Stats row
            Only shows pills for values that have been set.
            ============================================================ */}
        <div className="mt-4 flex flex-wrap gap-2">
          {profile.parks_visited_count > 0 && (
            <StatPill
              icon="📍"
              label="Parks"
              value={String(profile.parks_visited_count)}
            />
          )}
          {profile.stance && (
            <StatPill
              icon="🛹"
              label="Stance"
              value={capitalise(profile.stance)}
            />
          )}
          {profile.local_park && (
            <StatPill icon="🏠" label="Local" value={profile.local_park} />
          )}
        </div>

        {/* Follow counts — shown when provided */}
        {followCounts && (
          <div className="mt-4 flex gap-5 text-sm">
            <span>
              <span className="font-semibold text-ink">{followCounts.following}</span>{" "}
              <span className="text-muted">Following</span>
            </span>
            <span>
              <span className="font-semibold text-ink">{followCounts.followers}</span>{" "}
              <span className="text-muted">Followers</span>
            </span>
          </div>
        )}

        {/* Clips button — only rendered when onClipsClick is provided */}
        {onClipsClick && (
          <button
            type="button"
            onClick={onClipsClick}
            className="mt-4 w-full gs-btn-secondary text-center"
          >
            View Clips
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// StatPill — small labelled chip used in the stats row
// ============================================================
function StatPill({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-xl border border-line-soft bg-field px-3 py-1.5 text-sm">
      <span aria-hidden="true">{icon}</span>
      <span className="text-faint">{label}:</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}

// Capitalise first letter only (e.g. "regular" → "Regular")
function capitalise(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
