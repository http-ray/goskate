// ============================================================
// profilesService.ts
//
// All Supabase reads and writes for the profiles table.
//
// Three exported functions cover the main use cases:
//   getProfile(userId)     — fetch a profile row (or null)
//   ensureProfile(user)    — get or auto-create the row
//   updateProfile(userId)  — save editable fields
//
// The Profile type mirrors the profiles table columns exactly.
// The ProfileUpdate type limits what the user is allowed to change.
// ============================================================

import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import {
  LIMITS,
  USERNAME_RE,
  capOrNull,
  normalizeUsername,
  sanitizeSearchQuery,
} from "@/lib/validation";

// ============================================================
// Types
// ============================================================

/**
 * Matches the profiles table row exactly.
 * Use this wherever you need to display or work with profile data.
 */
export type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  stance: "regular" | "goofy" | null;
  local_park: string | null;
  parks_visited_count: number;
  is_public: boolean;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
};

/**
 * Fields the user is allowed to edit.
 * parks_visited_count, id, and timestamps are intentionally excluded.
 */
export type ProfileUpdate = Partial<
  Pick<
    Profile,
    | "username"
    | "display_name"
    | "avatar_url"
    | "banner_url"
    | "bio"
    | "stance"
    | "local_park"
    | "is_public"
  >
>;

// ============================================================
// getProfile
//
// Fetches a single profile row by the auth user's id.
// Returns null if no row exists yet (not an error).
// Throws on real database errors.
// ============================================================
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    // PostgREST error code PGRST116 means "no rows returned".
    // That's expected when the profile hasn't been created yet.
    if (error.code === "PGRST116") return null;
    throw error;
  }

  return data as Profile;
}

// ============================================================
// ensureProfile
//
// Call this right after a user signs in or signs up.
// It checks whether a profile row already exists and creates
// one with safe defaults if it doesn't.
//
// This is the safest way to guarantee every auth user has
// a matching profile row without duplicating insert logic.
// ============================================================
export async function ensureProfile(user: User): Promise<Profile> {
  // 1. Try to find an existing profile first
  const existing = await getProfile(user.id);
  if (existing) return existing;

  // 2. Build a fallback username from auth metadata or the email address
  //    (e.g. "dan@example.com" becomes "dan")
  const fallbackUsername = normalizeUsername(
    (user.user_metadata?.username as string | undefined) ||
      user.email?.split("@")[0] ||
      "skater"
  );

  // 3. Create the profile row with defaults
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      username: fallbackUsername,
      // Copy over any values the user set during sign-up
      display_name:
        (user.user_metadata?.display_name as string | undefined) || null,
      avatar_url:
        (user.user_metadata?.avatar_url as string | undefined) || null,
    })
    .select()
    .single();

  if (error) {
    // 23505 = unique_violation. Auth state can settle in two steps right
    // after email confirmation (an initial session, then a follow-up
    // onAuthStateChange once the URL token finishes parsing), which can
    // call ensureProfile twice before the first insert lands. The other
    // call already created the row — this isn't a real failure.
    if (error.code === "23505") {
      const created = await getProfile(user.id);
      if (created) return created;
    }
    throw error;
  }

  return data as Profile;
}

// ============================================================
// updateProfile
//
// Saves the editable fields for a profile.
// Only the fields included in `updates` are changed — everything
// else stays the same.
// Returns the full updated profile row.
// ============================================================
export async function updateProfile(
  userId: string,
  updates: ProfileUpdate
): Promise<Profile> {
  // Validate + cap user-supplied text before writing.
  const sanitized: ProfileUpdate = { ...updates };

  if (typeof sanitized.username === "string") {
    const u = sanitized.username.trim();
    if (u && !USERNAME_RE.test(u)) {
      throw new Error(
        "Username must be 3–30 characters using letters, numbers, . _ or -"
      );
    }
    sanitized.username = u || null;
  }
  if (typeof sanitized.display_name === "string") {
    sanitized.display_name = capOrNull(sanitized.display_name, LIMITS.displayName);
  }
  if (typeof sanitized.bio === "string") {
    sanitized.bio = capOrNull(sanitized.bio, LIMITS.bio);
  }
  if (typeof sanitized.local_park === "string") {
    sanitized.local_park = capOrNull(sanitized.local_park, LIMITS.localPark);
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(sanitized)
    .eq("id", userId)
    .select()
    .single();

  if (error) throw error;

  return data as Profile;
}

// ============================================================
// getProfileByUsername
//
// Fetches a public profile by username — used by /profile/[username].
// Returns null if the username is not found or the profile is private.
// For own-profile access (even if private), use getProfile(userId) instead.
// ============================================================
export async function getProfileByUsername(
  username: string
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .eq("is_public", true)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  return data as Profile;
}

// ============================================================
// searchProfiles
//
// Searches public profiles by username, display_name, or local_park.
// Returns up to 20 results. Only public profiles are returned.
// ============================================================
export async function searchProfiles(query: string): Promise<Profile[]> {
  // Strip characters that could alter the PostgREST .or() filter expression.
  const q = sanitizeSearchQuery(query);
  if (!q) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("is_public", true)
    .or(
      `username.ilike.%${q}%,display_name.ilike.%${q}%,local_park.ilike.%${q}%`
    )
    .limit(20);

  if (error) throw error;

  return (data || []) as Profile[];
}
