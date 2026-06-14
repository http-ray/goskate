// ============================================================
// clipsService.ts
//
// All reads and writes for the profile_clips table and
// cover image uploads to Supabase Storage (clip-covers bucket).
//
// No native video is stored — external_url links to TikTok,
// Instagram, YouTube, or other platforms.
//
// Exported functions:
//   getClipsForUser(userId)  — fetch clips for a profile
//   addClip(clip)            — add a new clip entry
//   deleteClip(clipId)       — delete a clip (and its cover if any)
//   uploadClipCover(...)     — upload a cover image, returns public URL
// ============================================================

import { supabase } from "@/lib/supabase";
import type { ProfileClip, NewClipInput } from "@/types/social";

// ---- getClipsForUser ----
// Returns clips for a given userId, ordered newest first.
// RLS gates this: public profiles return results for anyone;
// private profiles return results only to the owner.
export async function getClipsForUser(userId: string): Promise<ProfileClip[]> {
  const { data, error } = await supabase
    .from("profile_clips")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data || []) as ProfileClip[];
}

// ---- addClip ----
// Inserts a new clip. RLS enforces that user_id = auth.uid().
// Returns the newly created clip row.
export async function addClip(clip: NewClipInput): Promise<ProfileClip> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Must be signed in to add a clip.");

  if (!clip.external_url.startsWith("https://")) {
    throw new Error("Clip URL must start with https://");
  }

  const { data, error } = await supabase
    .from("profile_clips")
    .insert({
      user_id: user.id,
      title: clip.title || null,
      caption: clip.caption || null,
      platform: clip.platform,
      external_url: clip.external_url,
      cover_image_url: clip.cover_image_url || null,
      spot_id: clip.spot_id || null,
    })
    .select()
    .single();

  if (error) throw error;

  return data as ProfileClip;
}

// ---- deleteClip ----
// Deletes the clip row. If a cover image was stored, removes it from
// the clip-covers bucket as well. RLS enforces ownership.
export async function deleteClip(
  clipId: string,
  coverImagePath?: string
): Promise<void> {
  const { error } = await supabase
    .from("profile_clips")
    .delete()
    .eq("id", clipId);

  if (error) throw error;

  if (coverImagePath) {
    // Best-effort remove from storage — ignore errors (file may not exist)
    await supabase.storage.from("clip-covers").remove([coverImagePath]);
  }
}

// ---- uploadClipCover ----
// Uploads a cover image for a clip. Returns the public URL.
// Caller must validate file type and size BEFORE calling this.
// Path: {userId}/{clipId}.{ext}
export async function uploadClipCover(
  userId: string,
  clipId: string,
  file: File
): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${clipId}.${ext}`;

  const { error } = await supabase.storage
    .from("clip-covers")
    .upload(path, file, { upsert: true });

  if (error) throw error;

  const { data } = supabase.storage.from("clip-covers").getPublicUrl(path);
  return data.publicUrl;
}
