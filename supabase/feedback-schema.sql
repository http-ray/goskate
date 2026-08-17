-- ============================================================
-- Feedback — in-app feedback, replaces the old mailto: link.
-- Users write feedback on /profile/feedback; admins read it on
-- /admin/feedback. Run this once in the Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback (created_at DESC);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can submit feedback" ON feedback;
DROP POLICY IF EXISTS "Admins can read feedback" ON feedback;

-- Signed-in users can submit feedback as themselves. No SELECT policy
-- for regular users on purpose — this is a one-way inbox, not a thread.
CREATE POLICY "Users can submit feedback"
  ON feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Only admins (profiles.is_admin = true) can read submitted feedback.
CREATE POLICY "Admins can read feedback"
  ON feedback FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );
