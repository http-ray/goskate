-- ============================================================
-- GoSkate — Profiles Table Schema
--
-- Run this in the Supabase SQL Editor AFTER the spots table
-- (schema.sql) has already been applied.
--
-- Each row represents one skater's public/private profile.
-- It is linked to the auth.users table by user id so that
-- deleting an auth user automatically deletes their profile.
-- ============================================================

-- ============================================================
-- profiles table
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (

  -- Primary key — same UUID as the auth.users id.
  -- ON DELETE CASCADE means if the auth user is deleted,
  -- their profile row is also deleted automatically.
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,

  -- ---- Identity ----
  -- Unique handle shown with @ prefix (e.g. @sk8r_dan)
  username     TEXT UNIQUE,
  -- Friendly name shown in the UI (e.g. "Dan Hawk")
  display_name TEXT,

  -- ---- Images (URL strings for V1 — file upload in a future version) ----
  avatar_url   TEXT,
  banner_url   TEXT,

  -- ---- Skater info ----
  bio          TEXT,
  -- 'regular' or 'goofy' — NULL means not set yet
  stance       TEXT CHECK (stance IN ('regular', 'goofy') OR stance IS NULL),
  -- The user's home/local skatepark
  local_park   TEXT,

  -- ---- Stats (auto-managed — never set directly by the user) ----
  -- Incremented when a user checks in to or rates a new spot
  parks_visited_count INTEGER DEFAULT 0,

  -- ---- Privacy ----
  -- TRUE = profile is visible to other users
  -- FALSE = profile is private (enforced by RLS policies in a future version)
  is_public BOOLEAN DEFAULT TRUE,

  -- ---- Timestamps ----
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Row Level Security (RLS)
--
-- Enable RLS so rows are not wide-open by default.
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous users) can read public profiles.
-- Private profiles (is_public = false) are hidden — full enforcement
-- of profile privacy is scaffolded here but built out later.
CREATE POLICY "Public profiles are readable by everyone"
  ON profiles FOR SELECT
  USING (is_public = true);

-- A signed-in user can always read their own profile,
-- even if they have set it to private.
CREATE POLICY "Users can read their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- A signed-in user can insert their own profile row.
-- The WITH CHECK ensures they can't create a row for someone else.
CREATE POLICY "Users can create their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- A signed-in user can update only their own row.
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- A signed-in user can delete their own profile row.
CREATE POLICY "Users can delete their own profile"
  ON profiles FOR DELETE
  USING (auth.uid() = id);

-- ============================================================
-- Indexes
-- ============================================================

-- Fast username lookups (e.g. public profile pages at /u/:username)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username ON profiles (username);

-- Quickly filter to only public profiles
CREATE INDEX IF NOT EXISTS idx_profiles_is_public ON profiles (is_public) WHERE is_public = TRUE;

-- ============================================================
-- updated_at trigger
--
-- Automatically sets updated_at = NOW() on every UPDATE so
-- the app never has to remember to pass the timestamp.
-- ============================================================

-- Step 1: create the trigger function (shared across tables)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: attach the trigger to the profiles table
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Supabase Storage — avatar and banner images
--
-- V1 uses URL strings (avatar_url / banner_url).
-- When you are ready to add real file uploads, create two
-- public storage buckets in the Supabase dashboard:
--
--   Bucket name: avatars
--   Bucket name: banners
--
-- Then add these policies in the bucket settings:
--   - "Anyone can read" (SELECT) using: true
--   - "Users can upload their own files" (INSERT) using:
--       (auth.uid())::text = (storage.foldername(name))[1]
--
-- The upload path convention would be:
--   avatars/<user_id>/avatar.jpg
--   banners/<user_id>/banner.jpg
--
-- This is scaffolded here as comments; implement when adding
-- the file upload UI.
-- ============================================================
