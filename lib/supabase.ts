// ============================================================
// Supabase Client — shared browser client for the GoSkate app.
//
// This creates a single Supabase client instance that the
// entire frontend uses to read data from the spots table.
//
// Environment variables required:
//   NEXT_PUBLIC_SUPABASE_URL   — your Supabase project URL
//   NEXT_PUBLIC_SUPABASE_ANON_KEY — the "anon" (public) key
//
// Both must be prefixed with NEXT_PUBLIC_ so Next.js exposes
// them to the browser.
// ============================================================

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
