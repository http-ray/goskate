"use client";

// ============================================================
// AuthProvider — keeps the current Supabase session in React state.
//
// Why this exists:
//   - Supabase already persists sessions in the browser.
//   - This provider makes that session easy to read anywhere in the app.
//   - It also keeps the UI in sync when the user logs in, signs up,
//     updates their profile metadata, or logs out.
// ============================================================

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // onAuthStateChange alone is enough: it fires once immediately with
    // the current session (an INITIAL_SESSION event) when subscribed, then
    // again on every future change. A separate getSession() call used to
    // run in parallel with this — two independent writers to the same
    // state, racing on load order. Right after an email-confirmation
    // redirect (where the client still has to parse the token out of the
    // URL) that race could resolve session state twice in quick
    // succession, causing anything keyed on the user object (like
    // ensureProfile()) to run twice concurrently.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
    }),
    [loading, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
