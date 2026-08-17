// ============================================================
// Feedback — a message sent to admins, signed in or anonymous.
// Defined in supabase/feedback-schema.sql.
// ============================================================

export type FeedbackStatus = "new" | "read" | "focus" | "archived";

export type Feedback = {
  id: string;
  user_id: string | null;
  message: string;
  status: FeedbackStatus;
  created_at: string;
};
