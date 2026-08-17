// ============================================================
// Feedback — a message a signed-in user sends to admins.
// Defined in supabase/feedback-schema.sql.
// ============================================================

export type Feedback = {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
};
