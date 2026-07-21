// ============================================================
// validation.ts
//
// Small shared helpers for input validation and length caps on
// user-supplied text. Used by the write services (spots, clips,
// profiles) as a server-of-record for limits. The forms mirror
// these caps as maxLength attributes for immediate UX feedback.
// ============================================================

// Max character lengths for user-supplied text fields.
export const LIMITS = {
  spotName: 120,
  spotDescription: 1000,
  areaText: 120,
  clipTitle: 120,
  clipCaption: 500,
  username: 30,
  displayName: 60,
  bio: 300,
  localPark: 120,
} as const;

// Usernames: letters, numbers, and . _ - only. 3–30 chars.
export const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,30}$/;

// Trim and hard-cap a string to `max` characters.
export function capText(value: string, max: number): string {
  return value.trim().slice(0, max);
}

// Trim + cap; return null when the result is empty (for nullable columns).
export function capOrNull(value: string, max: number): string | null {
  const capped = capText(value, max);
  return capped.length ? capped : null;
}

// Normalize a raw username candidate (e.g. an email prefix) into a valid
// username: strip disallowed characters, cap length, and fall back to
// "skater" if nothing usable remains.
export function normalizeUsername(raw: string): string {
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_.-]/g, "");
  return cleaned.slice(0, LIMITS.username) || "skater";
}

// Escape characters that have special meaning inside a PostgREST `.or()`
// filter string so a user's search query cannot alter the filter logic.
export function sanitizeSearchQuery(q: string): string {
  return q.replace(/[,()*:]/g, " ").replace(/\s+/g, " ").trim();
}

// Latitude/longitude sanity checks.
export function isValidLatitude(lat: number): boolean {
  return Number.isFinite(lat) && lat >= -90 && lat <= 90;
}

export function isValidLongitude(lng: number): boolean {
  return Number.isFinite(lng) && lng >= -180 && lng <= 180;
}
