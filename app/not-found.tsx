// ============================================================
// Custom 404 — branded "page not found" shown for any route
// (or resource) that doesn't exist.
// ============================================================

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-base px-6 text-center text-ink">
      <div className="text-5xl font-extrabold text-accent">404</div>
      <div>
        <h1 className="text-xl font-bold">Page not found</h1>
        <p className="mt-2 max-w-sm text-sm text-muted">
          This spot doesn&apos;t exist — or it may have rolled away. Let&apos;s
          get you back on the map.
        </p>
      </div>
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <Link href="/map" className="gs-btn-primary px-6">
          Back to map
        </Link>
        <Link href="/" className="gs-btn-secondary px-6">
          Go home
        </Link>
      </div>
    </div>
  );
}
