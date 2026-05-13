"use client";

// ============================================================
// Providers — wraps the app with shared client-side context.
//
// For V1, this only provides auth state. It keeps the layout file
// clean and makes it easy to add more shared providers later.
// ============================================================

import { AuthProvider } from "@/components/auth/AuthProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
