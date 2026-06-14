// ============================================================
// Social types — follows and profile clips.
// These are separate from spot.ts to keep the core spot model
// clean. Both tables are defined in supabase/social-schema.sql.
// ============================================================

export type Follow = {
  follower_id: string;
  following_id: string;
  created_at: string;
};

export type ProfileClip = {
  id: string;
  user_id: string;
  title: string | null;
  caption: string | null;
  platform: "tiktok" | "instagram" | "youtube" | "other";
  external_url: string;
  cover_image_url: string | null;
  spot_id: string | null;
  created_at: string;
};

export type NewClipInput = {
  title?: string;
  caption?: string;
  platform: "tiktok" | "instagram" | "youtube" | "other";
  external_url: string;
  cover_image_url?: string;
  spot_id?: string;
};

export type FollowCounts = {
  followers: number;
  following: number;
};
