-- ============================================================
-- GoSkate — Spot Submission & Moderation Schema Updates
--
-- Run this AFTER the base spots table schema (schema.sql) has
-- been applied.
--
-- This adds columns and policies to support:
--   - User-submitted spots
--   - Moderation workflow (pending → approved/rejected/flagged)
--   - Basic duplicate detection
--   - Admin review interface
-- ============================================================

-- ============================================================
-- Add new columns to the spots table
-- ============================================================

-- Who submitted this spot (null for official spots imported from external sources)
ALTER TABLE spots ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Moderation status: pending, approved, rejected, flagged
ALTER TABLE spots ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved' CHECK (
  status IN ('pending', 'approved', 'rejected', 'flagged')
);

-- User-provided description (for user-submitted spots)
ALTER TABLE spots ADD COLUMN IF NOT EXISTS description TEXT;

-- Obstacle tags (rail, ledge, stairs, gap, flatground, bowl, manual pad)
-- Stored as JSON array for flexibility
ALTER TABLE spots ADD COLUMN IF NOT EXISTS obstacle_tags JSONB DEFAULT '[]';

-- Optional area/address text from the user
ALTER TABLE spots ADD COLUMN IF NOT EXISTS area_text TEXT;

-- Admin moderation notes (why rejected, flagged reason, etc.)
ALTER TABLE spots ADD COLUMN IF NOT EXISTS moderation_notes TEXT;

-- Who reviewed this spot (admin user id)
ALTER TABLE spots ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- When the spot was reviewed
ALTER TABLE spots ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- Flag set by duplicate detection algorithm
ALTER TABLE spots ADD COLUMN IF NOT EXISTS possible_duplicate BOOLEAN DEFAULT FALSE;

-- ============================================================
-- Update existing official spots to have status = 'approved'
-- (they were imported before the status column existed)
-- ============================================================
UPDATE spots SET status = 'approved' WHERE source = 'official' AND status IS NULL;

-- ============================================================
-- Indexes for moderation and filtering
-- ============================================================

-- Fast filtering by status (e.g. get all pending spots for admin review)
CREATE INDEX IF NOT EXISTS idx_spots_status ON spots (status);

-- Fast filtering by created_by (e.g. "show me all my submitted spots")
CREATE INDEX IF NOT EXISTS idx_spots_created_by ON spots (created_by) WHERE created_by IS NOT NULL;

-- Fast filtering of pending spots for admin review page
CREATE INDEX IF NOT EXISTS idx_spots_pending_review ON spots (status, created_at) WHERE status = 'pending';

-- Fast filtering of flagged spots
CREATE INDEX IF NOT EXISTS idx_spots_flagged ON spots (status) WHERE status = 'flagged';

-- Spatial index for duplicate detection (find nearby spots quickly)
-- Note: For production, consider PostGIS for true geospatial queries
CREATE INDEX IF NOT EXISTS idx_spots_lat_lng_btree ON spots (latitude, longitude);

-- ============================================================
-- Update RLS Policies
--
-- Current policy: "Anyone can read spots"
-- We need to restrict this so only approved spots are public.
-- Users should see their own pending submissions.
-- ============================================================

-- Drop the old wide-open read policy
DROP POLICY IF EXISTS "Anyone can read spots" ON spots;

-- New read policy: anyone can see approved spots
CREATE POLICY "Anyone can read approved spots"
  ON spots FOR SELECT
  USING (status = 'approved');

-- Users can see their own submissions regardless of status
CREATE POLICY "Users can read their own submissions"
  ON spots FOR SELECT
  USING (auth.uid() = created_by);

-- Authenticated users can insert new spots (with status = 'pending')
CREATE POLICY "Authenticated users can submit spots"
  ON spots FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = created_by
    AND status = 'pending'
    AND source = 'user'
  );

-- Users can update their own pending submissions (before approval)
-- Once approved/rejected, they can't edit it
CREATE POLICY "Users can update their own pending submissions"
  ON spots FOR UPDATE
  USING (
    auth.uid() = created_by
    AND status = 'pending'
  )
  WITH CHECK (
    auth.uid() = created_by
    AND status = 'pending'
  );

-- Users can delete their own pending submissions
CREATE POLICY "Users can delete their own pending submissions"
  ON spots FOR DELETE
  USING (
    auth.uid() = created_by
    AND status = 'pending'
  );

-- ============================================================
-- Admin Review Policies (placeholder)
--
-- For MVP, we'll use a simple approach:
--   - Check if user's email is in a hardcoded admin list
--   - OR check if profiles.is_admin = true (if you add that column)
--
-- For now, these policies are commented out. Implement admin
-- review in the app code with service role key or a custom
-- SQL function that checks admin status.
--
-- Example (requires adding is_admin to profiles table):
-- CREATE POLICY "Admins can read all spots"
--   ON spots FOR SELECT
--   USING (
--     EXISTS (
--       SELECT 1 FROM profiles
--       WHERE profiles.id = auth.uid()
--       AND profiles.is_admin = true
--     )
--   );
--
-- CREATE POLICY "Admins can update any spot"
--   ON spots FOR UPDATE
--   USING (
--     EXISTS (
--       SELECT 1 FROM profiles
--       WHERE profiles.id = auth.uid()
--       AND profiles.is_admin = true
--     )
--   );
-- ============================================================

-- ============================================================
-- Migration notes
--
-- This schema assumes the base spots table already exists.
-- If you're applying this to a fresh database, run schema.sql first.
--
-- After running this SQL:
--   1. Update spotsService to filter by status = 'approved'
--   2. Build the Add Spot UI (modal/page)
--   3. Build the Admin Review UI (/admin/review)
--   4. Add duplicate detection logic in submission flow
--
-- Security TODO:
--   - Add is_admin column to profiles table if using role-based admin
--   - Or maintain a hardcoded admin email list in app code
--   - Consider using Supabase Functions for admin actions with service role
-- ============================================================
