// ============================================================
// User Search — /users/search
//
// Debounced search across public profiles by username,
// display_name, and local_park. Shows ProfileCard results.
// ============================================================

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { searchProfiles, type Profile } from "@/lib/profilesService";
import ProfileCard from "@/components/ui/ProfileCard";
import { useToast } from "@/components/ui/Toast";

export default function UserSearchPage() {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const q = query.trim();

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!q) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const found = await searchProfiles(q);
        setResults(found);
        setHasSearched(true);
      } catch {
        setResults([]);
        setHasSearched(true);
        toast.error("Search failed. Please try again.");
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, toast]);

  return (
    <div className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-lg">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/map"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-sm text-zinc-400 hover:text-white"
          >
            ←
          </Link>
          <h1 className="text-xl font-bold">Find Skaters</h1>
        </div>

        {/* Search input */}
        <div className="relative mb-6">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by username, name, or local park..."
            autoFocus
            className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-zinc-500"
          />
          {searching && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
              Searching...
            </span>
          )}
        </div>

        {/* Results */}
        {hasSearched && results.length === 0 && (
          <p className="text-center text-sm text-zinc-500">
            No skaters found for &ldquo;{query}&rdquo;
          </p>
        )}

        {results.length > 0 && (
          <div className="flex flex-col gap-2">
            {results.map((profile) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                showFollowButton
              />
            ))}
          </div>
        )}

        {!hasSearched && !searching && (
          <p className="mt-12 text-center text-sm text-zinc-600">
            Type a username, display name, or local park to find skaters.
          </p>
        )}
      </div>
    </div>
  );
}
