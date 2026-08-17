// ============================================================
// feedbackService.ts
//
// submitFeedback(userId, message) — any signed-in user, writes
//   their own row (enforced by RLS).
// fetchFeedback() — admin-only read, enforced by RLS. Returns []
//   for non-admins rather than throwing, since the caller already
//   gates the page on profiles.is_admin.
// ============================================================

import { supabase } from "@/lib/supabase";
import type { Feedback } from "@/types/feedback";
import { LIMITS, capOrNull } from "@/lib/validation";

export async function submitFeedback(
  userId: string,
  message: string
): Promise<void> {
  const trimmed = capOrNull(message, LIMITS.feedbackMessage);
  if (!trimmed) {
    throw new Error("Feedback can't be empty.");
  }

  const { error } = await supabase
    .from("feedback")
    .insert({ user_id: userId, message: trimmed });

  if (error) throw error;
}

export async function fetchFeedback(): Promise<Feedback[]> {
  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data || []) as Feedback[];
}
