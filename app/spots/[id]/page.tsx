import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import type { Spot } from "@/types/spot";

export const dynamicParams = true;

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

interface SpotPageProps {
  params: Promise<{ id: string }>;
}

export default async function SpotPage({ params }: SpotPageProps) {
  const { id } = await params;
  const spot = await findSpot(id);
  if (!spot) return notFound();

  return (
    <div className="min-h-screen bg-black text-white px-5 py-8 font-sans max-w-lg mx-auto">
      {/* ---- Back link ---- */}
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white mb-6"
      >
        ← Back to map
      </Link>

      {/* ---- Name + badges ---- */}
      <h1 className="text-2xl font-bold mb-2">{spot.name}</h1>

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

      {/* ---- Coming Soon sections ---- */}
      <div className="space-y-4 mb-8">
        <div className="rounded-2xl border border-white/10 bg-zinc-900 px-6 py-5 text-center">
          <p className="text-sm font-semibold text-zinc-300 mb-1">People Here</p>
          <p className="text-xs text-zinc-500">Check-ins coming soon</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-zinc-900 px-6 py-5 text-center">
          <p className="text-sm font-semibold text-zinc-300 mb-1">Public Clips</p>
          <p className="text-xs text-zinc-500">Clip sharing coming soon</p>
        </div>
      </div>

      {/* ---- Get Directions ---- */}
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
