"use client";

import Link from "next/link";

export default function FriendsPage() {
  return (
    <div className="min-h-screen bg-black text-white px-5 py-8 font-sans max-w-lg mx-auto">
      {/* ---- Back ---- */}
      <Link
        href="/profile"
        className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white mb-6"
      >
        ← Back to profile
      </Link>

      <h1 className="text-2xl font-bold mb-2">Friends</h1>

      <div className="rounded-2xl border border-white/10 bg-zinc-900 px-6 py-12 text-center mt-6">
        <p className="text-2xl mb-3">🛹</p>
        <p className="text-sm font-semibold text-zinc-300 mb-1">Friends — Coming Soon</p>
        <p className="text-xs text-zinc-500">
          Follow other skaters, see where they skate, and share spots with your crew.
        </p>
      </div>
    </div>
  );
}
