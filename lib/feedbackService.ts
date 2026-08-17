// ============================================================
// feedbackService.ts
//
// submitFeedback(userId, message) — anyone, signed in or not
//   (pass null for userId when signed out). Writes are enforced
//   by RLS: a signed-in user can only write their own id, or null.
// fetchFeedback() — admin-only read, enforced by RLS.
// setFeedbackStatus(id, status) — admin-only triage update.
// deleteFeedback(id) — admin-only, permanent.
// ============================================================

import { supabase } from "@/lib/supabase";
import type { Feedback, FeedbackStatus } from "@/types/feedback";
import { LIMITS, capOrNull } from "@/lib/validation";

export async function submitFeedback(
  userId: string | null,
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

export async function setFeedbackStatus(
  id: string,
  status: FeedbackStatus
): Promise<void> {
  const { error } = await supabase.from("feedback").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function deleteFeedback(id: string): Promise<void> {
  const { error } = await supabase.from("feedback").delete().eq("id", id);
  if (error) throw error;
}
