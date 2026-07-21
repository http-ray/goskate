// ============================================================
// Global error boundary — the last-resort fallback for errors
// thrown in the root layout itself. It replaces the entire
// document, so it must render its own <html>/<body>.
// ============================================================

"use client";

import { useEffect } from "react";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="bg-base text-ink">
        <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
          <div className="text-4xl" aria-hidden="true">
            🛹
          </div>
          <div>
            <h1 className="text-xl font-bold">Something went wrong</h1>
            <p className="mt-2 max-w-sm text-sm text-muted">
              GoSkate ran into an unexpected error. Please try again.
            </p>
          </div>
          <button onClick={reset} className="gs-btn-primary px-6">
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
