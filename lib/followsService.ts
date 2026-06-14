// ============================================================
// followsService.ts
//
// All reads and writes for the user_follows table.
// Table schema is in supabase/social-schema.sql.
//
// Exported functions:
//   followUser(followingId)         — follow a user (INSERT)
//   unfollowUser(followingId)       — unfollow (DELETE)
//   getFollowCounts(userId)         — { followers, following } counts
//   getFollowStatus(targetUserId)   — true if current user follows target
//   getFollowers(userId)            — list of Profile rows that follow userId
//   getFollowing(userId)            — list of Profile rows userId follows
// ============================================================

import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/profilesService";
import type { FollowCounts } from "@/types/social";

// ---- followUser ----
// Inserts a row into user_follows. RLS enforces follower_id = auth.uid().
export async function followUser(followingId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Must be signed in to follow.");

  const { error } = await supabase
    .from("user_follows")
    .insert({ follower_id: user.id, following_id: followingId });

  if (error) throw error;
}

// ---- unfollowUser ----
// Deletes the follow row. RLS enforces that only follower can delete.
export async function unfollowUser(followingId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Must be signed in to unfollow.");

  const { error } = await supabase
    .from("user_follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("following_id", followingId);

  if (error) throw error;
}

// ---- getFollowCounts ----
// Returns { followers, following } counts for any user.
// Counts use the public SELECT policy (anyone can see follow relationships).
export async function getFollowCounts(userId: string): Promise<FollowCounts> {
  const [followersResult, followingResult] = await Promise.all([
    supabase
      .from("user_follows")
      .select("follower_id", { count: "exact", head: true })
      .eq("following_id", userId),
    supabase
      .from("user_follows")
      .select("following_id", { count: "exact", head: true })
      .eq("follower_id", userId),
  ]);

  return {
    followers: followersResult.count ?? 0,
    following: followingResult.count ?? 0,
  };
}

// ---- getFollowStatus ----
// Returns true if the currently authenticated user follows targetUserId.
// Returns false if not signed in or not following.
export async function getFollowStatus(targetUserId: string): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from("user_follows")
    .select("follower_id")
    .eq("follower_id", user.id)
    .eq("following_id", targetUserId)
    .maybeSingle();

  return data !== null;
}

// ---- getFollowing ----
// Returns the list of public profiles that userId follows.
export async function getFollowing(userId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("user_follows")
    .select("following_id, profiles!user_follows_following_id_fkey(*)")
    .eq("follower_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return ((data || []) as unknown as { profiles: Profile }[]).map(
    (row) => row.profiles
  );
}

// ---- getFollowers ----
// Returns the list of public profiles that follow userId.
export async function getFollowers(userId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("user_follows")
    .select("follower_id, profiles!user_follows_follower_id_fkey(*)")
    .eq("following_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return ((data || []) as unknown as { profiles: Profile }[]).map(
    (row) => row.profiles
  );
}
