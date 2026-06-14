import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import type { Spot } from "@/types/spot";

export const dynamicParams = true;

// ---- Spot ---------------------------------------------------------------

async function findSpot(id: string): Promise<Spot | null> {
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

// ---- Spot clips ---------------------------------------------------------
// Joins profile_clips with profiles so each clip carries the poster's name
// and avatar. RLS "Public clips are readable" automatically filters to clips
// whose owner has is_public = true — no extra WHERE needed here.

type SpotClip = {
  id: string;
  title: string | null;
  caption: string | null;
  platform: string;
  external_url: string;
  cover_image_url: string | null;
  created_at: string;
  profiles: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

async function findClipsForSpot(spotId: string): Promise<SpotClip[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return [];

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase
    .from("profile_clips")
    .select(
      `id, title, caption, platform, external_url, cover_image_url, created_at,
       profiles ( username, display_name, avatar_url )`
    )
    .eq("spot_id", spotId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as unknown as SpotClip[];
}

// ---- Platform display helpers -------------------------------------------

const PLATFORM_LABEL: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  other: "Clip",
};

// Tailwind classes used here must be written in full so the JIT scanner
// picks them up — dynamic string interpolation is not scanned.
const PLATFORM_COVER_BG: Record<string, string> = {
  tiktok: "bg-black",
  instagram: "bg-gradient-to-br from-purple-600 to-pink-500",
  youtube: "bg-red-600",
  other: "bg-zinc-700",
};

const PLATFORM_BADGE: Record<string, string> = {
  tiktok: "bg-black border-white/10",
  instagram: "bg-gradient-to-br from-purple-600 to-pink-500 border-transparent",
  youtube: "bg-red-600 border-transparent",
  other: "bg-zinc-700 border-white/10",
};

// ---- SpotClipCard -------------------------------------------------------
// Server-rendered clip card — simpler than the profile ClipCard because
// it has no embed or delete state. Cover image + user attribution + link.

function SpotClipCard({ clip }: { clip: SpotClip }) {
  const label = PLATFORM_LABEL[clip.platform] ?? "Clip";
  const coverBg = PLATFORM_COVER_BG[clip.platform] ?? "bg-zinc-700";
  const badgeBg = PLATFORM_BADGE[clip.platform] ?? "bg-zinc-700 border-white/10";

  const displayName =
    clip.profiles?.display_name || clip.profiles?.username || "GoSkater";
  const handle = clip.profiles?.username ? `@${clip.profiles.username}` : displayName;
  const initial = displayName[0]?.toUpperCase() ?? "G";

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900">
      {/* Cover image or platform-coloured placeholder */}
      {clip.cover_image_url ? (
        <img
          src={clip.cover_image_url}
          alt={clip.title ?? "Clip cover"}
          className="h-40 w-full object-cover"
        />
      ) : (
        <div
          className={`flex h-40 w-full items-center justify-center text-sm font-semibold text-white ${coverBg}`}
        >
          {label}
        </div>
      )}

      {/* Info */}
      <div className="p-3">
        {clip.title && (
          <p className="mb-2 truncate text-sm font-medium text-white">{clip.title}</p>
        )}

        {/* Poster + platform badge */}
        <div className="mb-2 flex items-center gap-2">
          {clip.profiles?.avatar_url ? (
            <img
              src={clip.profiles.avatar_url}
              alt={displayName}
              className="h-5 w-5 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-[10px] font-bold text-white">
              {initial}
            </div>
          )}
          <span className="min-w-0 flex-1 truncate text-xs text-zinc-400">{handle}</span>
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold text-white ${badgeBg}`}
          >
            {label}
          </span>
        </div>

        {clip.caption && (
          <p className="mb-2 line-clamp-2 text-xs text-zinc-500">{clip.caption}</p>
        )}

        <a
          href={clip.external_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-zinc-400 underline-offset-2 hover:text-white hover:underline"
        >
          Open clip ↗
        </a>
      </div>
    </div>
  );
}

// ---- Page ---------------------------------------------------------------

interface SpotPageProps {
  params: Promise<{ id: string }>;
}

export default async function SpotPage({ params }: SpotPageProps) {
  const { id } = await params;

  // Run spot lookup and clips fetch in parallel
  const [spot, clips] = await Promise.all([findSpot(id), findClipsForSpot(id)]);

  if (!spot) return notFound();

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-black px-5 py-8 font-sans text-white">

      {/* Back */}
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white"
      >
        ← Back to map
      </Link>

      {/* Name + type/source badges */}
      <h1 className="mb-2 text-2xl font-bold">{spot.name}</h1>

      <div className="mb-6 flex flex-wrap gap-2">
        <span
          className="rounded-full px-3 py-1 text-xs font-semibold text-white"
          style={{ background: spot.type === "skatepark" ? "#6366f1" : "#ef4444" }}
        >
          {spot.type === "skatepark" ? "Skatepark" : "Street"}
        </span>
        <span
          className="rounded-full px-3 py-1 text-xs font-semibold"
          style={{
            background: spot.source === "official" ? "#22c55e" : "#f59e0b",
            color: spot.source === "official" ? "#fff" : "#000",
          }}
        >
          {spot.source === "official" ? "Official" : "User Added"}
        </span>
      </div>

      {/* Public Clips */}
      <section className="mb-8">
        <div className="mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Public Clips
          </h2>
          <p className="mt-0.5 text-xs text-zinc-600">Clips shared at this spot</p>
        </div>

        {clips.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-zinc-900 px-6 py-8 text-center">
            <p className="text-sm text-zinc-400">No clips shared here yet.</p>
            <p className="mt-1 text-xs text-zinc-600">
              Be the first to add one from your profile.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {clips.map((clip) => (
              <SpotClipCard key={clip.id} clip={clip} />
            ))}
          </div>
        )}
      </section>

      {/* Get Directions */}
      <a
        href={`https://www.google.com/maps/dir/?api=1&destination=${spot.latitude},${spot.longitude}&travelmode=walking`}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full rounded-xl bg-blue-500 py-3 text-center text-sm font-bold text-white transition-colors hover:bg-blue-600"
      >
        📍 Get Directions
      </a>
    </div>
  );
}
