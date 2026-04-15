// ============================================================
// Profile Hub — /profile
//
// The main profile page showing the current user's info, stats,
// and quick-nav cards to Edit Profile, Friends, and Settings.
//
// Uses mock data from data/demoUser.ts — no auth required.
// ============================================================

import Link from "next/link";
import { DEMO_USER } from "@/data/demoUser";

export default function ProfilePage() {
  const user = DEMO_USER;

  return (
    <div className="min-h-screen bg-black text-white px-5 py-8 font-sans max-w-lg mx-auto">
      {/* ---- Back to map ---- */}
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white mb-6"
      >
        ← Back to map
      </Link>

      {/* ============================================
          PROFILE HEADER
          ============================================ */}
      <div className="flex items-center gap-4 mb-6">
        {/* Avatar placeholder — first letter of display name */}
        <div className="flex-shrink-0 w-20 h-20 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center text-3xl font-bold text-zinc-400">
          {user.displayName[0]}
        </div>

        <div className="min-w-0">
          <h1 className="text-xl font-bold truncate">{user.displayName}</h1>
          <p className="text-sm text-zinc-400 truncate">@{user.username}</p>
        </div>
      </div>

      {/* Bio */}
      <p className="text-sm text-zinc-300 mb-6 leading-relaxed">{user.bio}</p>

      {/* ============================================
          STATS ROW
          ============================================ */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard label="Clips" value={user.clipsCount} />
        <StatCard label="Check-Ins" value={user.checkInsCount} />
        <StatCard label="Friends" value={user.friendsCount} />
      </div>

      {/* ============================================
          PROFILE DETAILS
          ============================================ */}
      <div className="rounded-xl bg-zinc-900 divide-y divide-zinc-800 mb-6">
        <DetailRow label="Home Park" value={user.homePark} />
        <DetailRow label="Stance" value={capitalize(user.stance)} />
        <DetailRow label="Favorite Trick" value={user.favoriteTrick} />
      </div>

      {/* ============================================
          QUICK NAV CARDS
          ============================================ */}
      <div className="flex flex-col gap-3">
        <NavCard
          href="/profile/edit"
          icon="✏️"
          title="Edit Profile"
          subtitle="Update your info and preferences"
        />
        <NavCard
          href="/profile/friends"
          icon="👥"
          title="Friends"
          subtitle={`${user.friendsCount} friends`}
        />
        <NavCard
          href="/profile/settings"
          icon="⚙️"
          title="Settings"
          subtitle="Account, privacy, appearance"
        />
      </div>
    </div>
  );
}

// ============================================================
// Helper components
// ============================================================

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-zinc-900 px-3 py-3 text-center">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center px-4 py-3">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-sm font-medium truncate ml-4">{value}</span>
    </div>
  );
}

function NavCard({
  href,
  icon,
  title,
  subtitle,
}: {
  href: string;
  icon: string;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-xl bg-zinc-900 px-4 py-4 active:bg-zinc-800 transition-colors"
    >
      <span className="text-2xl">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-zinc-500 truncate">{subtitle}</p>
      </div>
      {/* Chevron */}
      <span className="ml-auto text-zinc-600 text-sm">›</span>
    </Link>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
