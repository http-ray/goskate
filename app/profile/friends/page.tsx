// ============================================================
// Friends Page — /profile/friends
//
// Shows the user's friend list from mock data, plus placeholder
// actions for Add Friend, Friend Requests, and Search Users.
//
// Each friend card shows an avatar placeholder, username,
// display name, and a short status line.
// ============================================================

"use client";

import Link from "next/link";
import { DEMO_FRIENDS } from "@/data/demoUser";

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
      <p className="text-sm text-zinc-500 mb-6">
        {DEMO_FRIENDS.length} friend{DEMO_FRIENDS.length === 1 ? "" : "s"}
      </p>

      {/* ============================================
          ACTION BUTTONS — placeholders
          ============================================ */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <ActionButton icon="➕" label="Add Friend" />
        <ActionButton icon="📩" label="Requests" />
        <ActionButton icon="🔍" label="Search" />
      </div>

      {/* ============================================
          FRIENDS LIST
          ============================================ */}
      <div className="flex flex-col gap-2">
        {DEMO_FRIENDS.map((friend) => (
          <div
            key={friend.id}
            className="flex items-center gap-3 rounded-xl bg-zinc-900 px-4 py-3"
          >
            {/* Avatar — first letter */}
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-sm font-bold text-zinc-400">
              {friend.displayName[0]}
            </div>

            {/* Name & status */}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">
                {friend.displayName}
              </p>
              <p className="text-xs text-zinc-500 truncate">
                @{friend.username}
              </p>
            </div>

            {/* Status text */}
            <p className="text-[11px] text-zinc-600 text-right max-w-[120px] truncate flex-shrink-0">
              {friend.status}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Helper
// ============================================================

function ActionButton({ icon, label }: { icon: string; label: string }) {
  return (
    <button
      onClick={() => alert(`${label} — coming soon!`)}
      className="flex flex-col items-center gap-1 rounded-xl bg-zinc-900 py-3 text-center active:bg-zinc-800 transition-colors"
    >
      <span className="text-xl">{icon}</span>
      <span className="text-[11px] text-zinc-400 font-medium">{label}</span>
    </button>
  );
}
