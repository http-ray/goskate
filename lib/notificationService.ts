// Lightweight localStorage-based notification helpers.
//
// Strategy: the profile page writes the current follower count as "seen"
// after loading. BottomLeftWidget reads the stored count on mount, fetches
// the live count, and shows a badge if the live count has grown.
//
// No database table or push infrastructure needed for this MVP approach.

const followerKey = (userId: string) => `goskate_seen_followers_${userId}`;

export function getSeenFollowerCount(userId: string): number | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(followerKey(userId));
  return stored === null ? null : parseInt(stored, 10);
}

export function setSeenFollowerCount(userId: string, count: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(followerKey(userId), String(count));
}
