-- ============================================================
-- GoSkate Social Schema
-- Run this in the Supabase SQL editor ONCE before launching
-- social features. Safe to re-run (uses IF NOT EXISTS / DROP IF EXISTS).
-- ============================================================

-- ============================================================
-- TABLE: user_follows
-- Simple one-directional follow system (no mutual friend requests).
-- follower_id follows following_id.
-- ============================================================

CREATE TABLE IF NOT EXISTS user_follows (
  follower_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id != following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower  ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON user_follows(following_id);

-- ---- RLS ----
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view follows"   ON user_follows;
DROP POLICY IF EXISTS "Users can follow others"   ON user_follows;
DROP POLICY IF EXISTS "Users can unfollow"        ON user_follows;

-- Anyone can read follow relationships (needed for public follower/following counts)
CREATE POLICY "Anyone can view follows"
  ON user_follows FOR SELECT
  USING (true);

-- Users can only create follows where they are the follower
CREATE POLICY "Users can follow others"
  ON user_follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

-- Users can only delete their own follows
CREATE POLICY "Users can unfollow"
  ON user_follows FOR DELETE
  USING (auth.uid() = follower_id);


-- ============================================================
-- TABLE: profile_clips
-- External video links skaters add to their profiles.
-- No native video storage — external_url points to TikTok / IG / YouTube / other.
-- cover_image_url is optional; stored in the 'clip-covers' Storage bucket.
-- ============================================================

CREATE TABLE IF NOT EXISTS profile_clips (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title           TEXT,
  caption         TEXT,
  platform        TEXT CHECK (platform IN ('tiktok', 'instagram', 'youtube', 'other')) NOT NULL,
  external_url    TEXT NOT NULL,
  cover_image_url TEXT,
  spot_id         UUID REFERENCES spots(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clips_user ON profile_clips(user_id, created_at DESC);

-- ---- RLS ----
ALTER TABLE profile_clips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public clips are readable"  ON profile_clips;
DROP POLICY IF EXISTS "Users can read own clips"   ON profile_clips;
DROP POLICY IF EXISTS "Users can add clips"        ON profile_clips;
DROP POLICY IF EXISTS "Users can update clips"     ON profile_clips;
DROP POLICY IF EXISTS "Users can delete clips"     ON profile_clips;

-- Anyone can read clips from public profiles
CREATE POLICY "Public clips are readable"
  ON profile_clips FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = profile_clips.user_id
        AND profiles.is_public = true
    )
  );

-- Users can always read their own clips (even if their profile is private)
CREATE POLICY "Users can read own clips"
  ON profile_clips FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert clips for themselves
CREATE POLICY "Users can add clips"
  ON profile_clips FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own clips. WITH CHECK matches USING so a user
-- can't reassign user_id to someone else's id as part of the update.
CREATE POLICY "Users can update clips"
  ON profile_clips FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own clips
CREATE POLICY "Users can delete clips"
  ON profile_clips FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================================
-- STORAGE BUCKETS
-- Create these manually in Supabase Dashboard → Storage, or
-- run via Supabase CLI / management API. SQL cannot create buckets.
--
-- Bucket: avatars
--   - Public read
--   - Path: {userId}/avatar.{ext}
--   - Policy: authenticated users can upload/update/delete under their own {userId}/ prefix
--
-- Bucket: clip-covers
--   - Public read
--   - Path: {userId}/{clipId}.{ext}
--   - Policy: authenticated users can upload/update/delete under their own {userId}/ prefix
--
-- Storage policy SQL (run after creating buckets in dashboard):
-- ============================================================

-- avatars bucket policies
INSERT INTO storage.buckets (id, name, public)
  VALUES ('avatars', 'avatars', true)
  ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own avatar
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Avatars are publicly readable" ON storage.objects;
CREATE POLICY "Avatars are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- clip-covers bucket policies
INSERT INTO storage.buckets (id, name, public)
  VALUES ('clip-covers', 'clip-covers', true)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload own clip covers" ON storage.objects;
CREATE POLICY "Users can upload own clip covers"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'clip-covers'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can update own clip covers" ON storage.objects;
CREATE POLICY "Users can update own clip covers"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'clip-covers'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete own clip covers" ON storage.objects;
CREATE POLICY "Users can delete own clip covers"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'clip-covers'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Clip covers are publicly readable" ON storage.objects;
CREATE POLICY "Clip covers are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'clip-covers');


-- ============================================================
-- VERIFY (run after applying)
-- ============================================================
-- SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE tablename IN ('user_follows', 'profile_clips')
--   ORDER BY tablename, cmd;
