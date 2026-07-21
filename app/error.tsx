// ============================================================
// Route error boundary — catches render/runtime errors in any
// page and shows a branded fallback instead of the raw Next.js
// error overlay. Must be a Client Component.
// ============================================================

"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface for debugging; in prod this goes to the browser console only.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-base px-6 text-center text-ink">
      <div className="text-4xl" aria-hidden="true">
        🛹
      </div>
      <div>
        <h1 className="text-xl font-bold">Something went wrong</h1>
        <p className="mt-2 max-w-sm text-sm text-muted">
          We hit a snag loading this page. You can try again, or head back to
          the map.
        </p>
      </div>
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <button onClick={reset} className="gs-btn-primary px-6">
          Try again
        </button>
        <Link href="/map" className="gs-btn-secondary px-6">
          Back to map
        </Link>
      </div>
    </div>
  );
}
