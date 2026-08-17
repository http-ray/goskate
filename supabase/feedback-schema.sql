-- ============================================================
-- Feedback — in-app feedback, replaces the old mailto: link.
-- Anyone, signed in or not, can submit from /profile/feedback.
-- Admins triage it on /admin/feedback (mark read, focus, archive,
-- or delete). Every statement here is idempotent — safe to re-run
-- even if an earlier version of this file already ran.
-- ============================================================

CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Allow anonymous feedback (user_id may be null). Needed even if the
-- table already exists from an earlier run with user_id NOT NULL.
ALTER TABLE feedback ALTER COLUMN user_id DROP NOT NULL;

-- Admin triage status
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new';

ALTER TABLE feedback DROP CONSTRAINT IF EXISTS feedback_status_check;
ALTER TABLE feedback ADD CONSTRAINT feedback_status_check
  CHECK (status IN ('new', 'read', 'focus', 'archived'));

CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback (status);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can submit feedback" ON feedback;
DROP POLICY IF EXISTS "Anyone can submit feedback" ON feedback;
DROP POLICY IF EXISTS "Admins can read feedback" ON feedback;
DROP POLICY IF EXISTS "Admins can update feedback" ON feedback;
DROP POLICY IF EXISTS "Admins can delete feedback" ON feedback;

-- Anyone can submit — signed in as themselves, or anonymously with
-- user_id left null. Nobody can submit feedback attributed to
-- someone else.
CREATE POLICY "Anyone can submit feedback"
  ON feedback FOR INSERT
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

-- Only admins can read, triage (update status), or delete feedback.
CREATE POLICY "Admins can read feedback"
  ON feedback FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

CREATE POLICY "Admins can update feedback"
  ON feedback FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

CREATE POLICY "Admins can delete feedback"
  ON feedback FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );
