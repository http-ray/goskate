// ============================================================
// Spot Detail Page — /spots/[id]
//
// A mini social / activity hub for a single skate spot.
// Reached via the "View Spot" button in the map popup.
//
// Sections:
//   1. Header — spot name, type & source badges, stats
//   2. People Here — friends and others currently at the spot
//   3. Public Clips — recent clips posted at this spot
//   4. Get Directions button
//
// Supports both local mock spots (user-*) and Supabase official
// spots (UUIDs). Falls back to Supabase if not found locally.
// ============================================================

import Link from "next/link";
import { notFound } from "next/navigation";
import { getSpotById, DEMO_SPOTS } from "@/data/demoSpots";
import { createClient } from "@supabase/supabase-js";
import type { Spot } from "@/types/spot";
import {
  getPeopleAtSpot,
  getClipsForSpot,
  timeAgo,
  type PersonHere,
  type PublicClip,
} from "@/data/demoSpotActivity";

// Pre-render local user spot IDs at build time.
// Supabase spots use dynamic rendering (fetched on demand).
export function generateStaticParams() {
  return DEMO_SPOTS.map((spot) => ({ id: spot.id }));
}

// Allow dynamic routes for Supabase spots (UUIDs not pre-rendered)
export const dynamicParams = true;

/**
 * Try to find a spot — first in local mock data, then in Supabase.
 */
async function findSpot(id: string): Promise<Spot | null> {
  // Check local mock data first
  const local = getSpotById(id);
  if (local) return local;

  // Not found locally — try Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) return null;

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase
    .from("spots")
    .select("id, display_name, latitude, longitude, type, source")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    name: data.display_name,
    latitude: data.latitude,
    longitude: data.longitude,
    type: data.type,
    source: data.source,
  };
}

interface SpotPageProps {
  params: Promise<{ id: string }>;
}

export default async function SpotPage({ params }: SpotPageProps) {
  const { id } = await params;
  const spot = await findSpot(id);
  if (!spot) return notFound();

  const { friends, others } = getPeopleAtSpot(id);
  const clips = getClipsForSpot(id);

  return (
    <div className="min-h-screen bg-black text-white px-5 py-8 font-sans max-w-lg mx-auto">
      {/* ---- Back link ---- */}
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white mb-6"
      >
        ← Back to map
      </Link>

      {/* ============================================
          HEADER — name, badges, stats
          ============================================ */}
      <h1 className="text-2xl font-bold mb-2">{spot.name}</h1>

      {/* Badges */}
      <div className="flex gap-2 flex-wrap mb-4">
        <span
          className="text-xs font-semibold px-3 py-1 rounded-full"
          style={{
            background: spot.type === "skatepark" ? "#6366f1" : "#ef4444",
          }}
        >
          {spot.type === "skatepark" ? "Skatepark" : "Street"}
        </span>
        <span
          className="text-xs font-semibold px-3 py-1 rounded-full"
          style={{
            background: spot.source === "official" ? "#22c55e" : "#f59e0b",
            color: spot.source === "official" ? "#fff" : "#000",
          }}
        >
          {spot.source === "official" ? "Official" : "User Added"}
        </span>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <StatCard
          label="Clips"
          value={spot.clipsCount !== undefined ? String(spot.clipsCount) : "—"}
          icon="🎬"
        />
        <StatCard
          label="Skaters Here"
          value={
            spot.activeSkaters !== undefined ? String(spot.activeSkaters) : "—"
          }
          icon="🛹"
        />
      </div>

      {/* ============================================
          PEOPLE HERE
          ============================================ */}
      <section className="mb-8">
        <h2 className="text-lg font-bold mb-3">People Here</h2>

        {friends.length === 0 && others.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No one checked in right now.
          </p>
        ) : (
          <>
            {/* Friends */}
            {friends.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-2">
                  Friends Here
                </h3>
                <div className="flex flex-wrap gap-2">
                  {friends.map((p) => (
                    <PersonChip key={p.username} person={p} />
                  ))}
                </div>
              </div>
            )}

            {/* Others */}
            {others.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                  Others Here
                </h3>
                <div className="flex flex-wrap gap-2">
                  {others.map((p) => (
                    <PersonChip key={p.username} person={p} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* ============================================
          PUBLIC CLIPS
          ============================================ */}
      <section className="mb-8">
        <h2 className="text-lg font-bold mb-3">Public Clips</h2>

        {clips.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No clips yet — be the first to post!
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {clips.map((clip) => (
              <ClipCard key={clip.id} clip={clip} />
            ))}
          </div>
        )}
      </section>

      {/* ============================================
          GET DIRECTIONS
          ============================================ */}
      <a
        href={`https://www.google.com/maps/dir/?api=1&destination=${spot.latitude},${spot.longitude}&travelmode=walking`}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full text-center py-3 rounded-xl bg-blue-500 text-white font-bold text-sm hover:bg-blue-600 transition-colors"
      >
        📍 Get Directions
      </a>
    </div>
  );
}

// ============================================================
// Small helper components used above
// ============================================================

/** A rounded chip showing a username + coloured ring for friends */
function PersonChip({ person }: { person: PersonHere }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full"
      style={{
        background: person.isFriend ? "#14532d" : "#27272a",
        border: person.isFriend ? "1px solid #22c55e" : "1px solid #3f3f46",
      }}
    >
      {/* Avatar placeholder — first letter */}
      <span
        className="flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold"
        style={{
          background: person.isFriend ? "#22c55e" : "#52525b",
          color: "#fff",
        }}
      >
        {person.username[0].toUpperCase()}
      </span>
      @{person.username}
    </span>
  );
}

/** A card representing a single public clip */
function ClipCard({ clip }: { clip: PublicClip }) {
  return (
    <div className="rounded-xl bg-zinc-900 p-4 flex gap-3">
      {/* Thumbnail placeholder */}
      <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-zinc-800 flex items-center justify-center text-2xl">
        🎥
      </div>

      {/* Text content */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold truncate">{clip.trickName}</p>
        <p className="text-xs text-zinc-400 truncate">@{clip.username}</p>
        <p className="text-xs text-zinc-500 mt-1 line-clamp-2">
          {clip.caption}
        </p>
        <p className="text-[11px] text-zinc-600 mt-1">
          {timeAgo(clip.postedSecondsAgo)}
        </p>
      </div>
    </div>
  );
}

/** Compact stat card with icon */
function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="rounded-xl bg-zinc-900 px-4 py-3 flex items-center gap-3">
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-xs text-zinc-500">{label}</p>
        <p className="text-lg font-semibold">{value}</p>
      </div>
    </div>
  );
}
