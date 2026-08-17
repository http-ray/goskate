// ============================================================
// Landing page — the public front door for GoSkate.
//
// Server component (static). Explains what GoSkate is to a
// first-time / signed-out visitor and routes them into the app:
//   • "Explore the map" → /map
//   • "Sign in / Sign up" → /profile (the auth hub)
//
// The full-screen map now lives at /map.
// ============================================================

import Link from "next/link";

const FEATURES = [
  {
    icon: "🗺️",
    title: "Interactive spot map",
    body: "Thousands of skateparks and street spots, clustered and searchable — filter by type and zoom straight to your area.",
  },
  {
    icon: "📍",
    title: "Add your spots",
    body: "Found a spot that isn't on the map? Drop a pin and add it. It goes live after a quick review.",
  },
  {
    icon: "👥",
    title: "Follow skaters",
    body: "Build your crew, follow other skaters, and see who's repping the spots near you.",
  },
  {
    icon: "🎬",
    title: "Share clips",
    body: "Link your TikTok, Instagram, or YouTube clips to the exact spot they were filmed at.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-base text-ink">
      {/* ---- Top bar ---- */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/skateicon.png"
            alt=""
            className="h-8 w-8 object-contain"
          />
          <span className="text-lg font-bold tracking-tight">GoSkate</span>
        </div>
        <Link
          href="/profile"
          className="text-sm font-semibold text-muted transition-colors hover:text-ink"
        >
          Sign in
        </Link>
      </header>

      {/* ---- Hero ---- */}
      <section className="mx-auto max-w-5xl px-5 pb-16 pt-10 text-center sm:pt-16">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-accent">
          The map built for skaters
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl md:text-6xl">
          Find your next skate spot.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
          Discover skateparks and street spots near you, add your own, follow
          other skaters, and share your clips — all on one map.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/map"
            className="gs-btn-primary w-full px-8 text-base sm:w-auto"
          >
            Explore the map
          </Link>
          <Link
            href="/profile"
            className="gs-btn-secondary w-full px-8 text-base sm:w-auto"
          >
            Create an account
          </Link>
        </div>

        <p className="mt-6 text-xs text-faint">
          🇺🇸 coast to coast, spot by spot — mapping every state, one push at
          a time.
        </p>
      </section>

      {/* ---- Features ---- */}
      <section className="mx-auto max-w-5xl px-5 pb-20">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="gs-card p-6">
              <div className="mb-3 text-2xl" aria-hidden="true">
                {f.icon}
              </div>
              <h2 className="mb-1.5 text-lg font-bold">{f.title}</h2>
              <p className="text-sm leading-relaxed text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Closing CTA ---- */}
      <section className="mx-auto max-w-5xl px-5 pb-24">
        <div className="gs-card flex flex-col items-center gap-5 px-6 py-12 text-center">
          <h2 className="max-w-xl text-2xl font-bold sm:text-3xl">
            Ready to roll?
          </h2>
          <p className="max-w-md text-sm text-muted">
            Jump straight into the map — no account needed to browse. Sign up
            when you want to add spots, follow skaters, and post clips.
          </p>
          <Link href="/map" className="gs-btn-primary px-8 text-base">
            Explore the map
          </Link>
        </div>
      </section>

      {/* ---- Footer ---- */}
      <footer className="border-t border-line-soft">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-5 py-6 text-xs text-faint sm:flex-row">
          <span>GoSkate — built with 🛹</span>
          <div className="flex items-center gap-4">
            <Link href="/map" className="transition-colors hover:text-muted">
              Map
            </Link>
            <Link
              href="/users/search"
              className="transition-colors hover:text-muted"
            >
              Find skaters
            </Link>
            <Link href="/profile" className="transition-colors hover:text-muted">
              Account
            </Link>
            <Link
              href="/profile/feedback"
              className="transition-colors hover:text-muted"
            >
              Feedback
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
