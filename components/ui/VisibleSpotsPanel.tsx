// ============================================================
// VisibleSpotsPanel — lists the skate spots currently visible
// inside the map viewport.
//
// Layout:
//   Mobile:  a compact pill sits above the bottom dock.
//            Tapping the pill opens a slide-up bottom sheet
//            with the full scrollable list.
//
//   Desktop: a fixed right-side floating panel that is always
//            visible and scrollable.
//
// Features:
//   - Search by name, area, type, source
//   - Filter chips: All, Official, User, Skateparks, Street
//   - Area-based grouping after filtering
//   - Priority: area_text → "Other Nearby"
//
// Props:
//   spots       — spots currently inside the map viewport
//                 (calculated by MapView from Leaflet bounds)
//   onSpotClick — called when the user taps a spot row;
//                 MapView uses this to fly the map there
// ============================================================

"use client";

import { useState, useMemo } from "react";
import { Spot } from "@/types/spot";

interface VisibleSpotsPanelProps {
  spots: Spot[];
  onSpotClick: (spot: Spot) => void;
}

type FilterType = "all" | "official" | "user" | "skatepark" | "street";

export default function VisibleSpotsPanel({
  spots,
  onSpotClick,
}: VisibleSpotsPanelProps) {
  // Controls whether the mobile bottom sheet is open or collapsed.
  const [isOpen, setIsOpen] = useState(false);

  // Search and filter state
  const [searchText, setSearchText] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  const count = spots.length;

  // ---- Filter and search logic ----
  const filteredSpots = useMemo(() => {
    let filtered = spots;

    // Apply filter
    if (activeFilter === "official") {
      filtered = filtered.filter((s) => s.source === "official");
    } else if (activeFilter === "user") {
      filtered = filtered.filter((s) => s.source === "user");
    } else if (activeFilter === "skatepark") {
      filtered = filtered.filter((s) => s.type === "skatepark");
    } else if (activeFilter === "street") {
      filtered = filtered.filter((s) => s.type === "street");
    }

    // Apply search text
    if (searchText.trim()) {
      const query = searchText.toLowerCase().trim();
      filtered = filtered.filter((s) => {
        const matchName = s.name.toLowerCase().includes(query);
        const matchArea = s.areaText?.toLowerCase().includes(query);
        const matchType = s.type.toLowerCase().includes(query);
        const matchSource = s.source.toLowerCase().includes(query);

        return matchName || matchArea || matchType || matchSource;
      });
    }

    return filtered;
  }, [spots, activeFilter, searchText]);

  // ---- Group by area ----
  const groupedSpots = useMemo(() => {
    const groups = new Map<string, Spot[]>();

    filteredSpots.forEach((spot) => {
      // Priority: areaText → "Other Nearby"
      const key = spot.areaText || "Other Nearby";

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(spot);
    });

    // Sort groups alphabetically, but keep "Other Nearby" last
    const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
      if (a === "Other Nearby") return 1;
      if (b === "Other Nearby") return -1;
      return a.localeCompare(b);
    });

    // Sort spots within each group alphabetically
    sortedKeys.forEach((key) => {
      groups.get(key)!.sort((a, b) => a.name.localeCompare(b.name));
    });

    return { groups, sortedKeys };
  }, [filteredSpots]);

  // ---- Shared spot-row renderer ----
  // Called in both the mobile sheet and desktop panel.
  // closeOnClick: true on mobile so the sheet collapses after selection.
  function renderSpotRow(spot: Spot, closeOnClick: boolean) {
    const isOfficial = spot.source === "official";
    const isSkatepark = spot.type === "skatepark";

    return (
      <button
        key={spot.id}
        onClick={() => {
          onSpotClick(spot);
          // On mobile, dismiss the sheet so the user can see the map.
          if (closeOnClick) setIsOpen(false);
        }}
        className="w-full border-b border-white/5 px-4 py-3 text-left transition-colors last:border-0 hover:bg-white/5 active:bg-white/10"
      >
        <div className="flex items-start gap-3">
          {/* Colour dot — green for official, amber for user-added */}
          <div
            className={`mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ${
              isOfficial ? "bg-green-500" : "bg-amber-500"
            }`}
          />

          <div className="min-w-0 flex-1">
            {/* Spot name — truncated when too long */}
            <p className="truncate text-sm font-medium text-white">
              {spot.name}
            </p>

            {/* Type + source + clips badges */}
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {/* Spot type */}
              <span
                className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                  isSkatepark
                    ? "bg-blue-500/20 text-blue-300"
                    : "bg-zinc-600/40 text-zinc-300"
                }`}
              >
                {isSkatepark ? "Skatepark" : "Street"}
              </span>

              {/* Source */}
              <span
                className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                  isOfficial
                    ? "bg-green-500/20 text-green-300"
                    : "bg-amber-500/20 text-amber-300"
                }`}
              >
                {isOfficial ? "Official" : "User"}
              </span>

              {/* Clips count — only shown when the spot has clips */}
              {spot.clipsCount !== undefined && spot.clipsCount > 0 && (
                <span className="text-[11px] text-zinc-400">
                  🎬 {spot.clipsCount}
                </span>
              )}
            </div>
          </div>

          {/* Right-pointing chevron — signals the row is tappable */}
          <svg
            className="mt-0.5 flex-shrink-0 text-zinc-600"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </button>
    );
  }

  // ---- Shared empty-state message ----
  const emptyMessage =
    count === 0 ? (
      <p className="px-4 py-8 text-center text-sm text-zinc-500">
        No spots visible here.
        <br />
        Pan or zoom out to find more.
      </p>
    ) : (
      <p className="px-4 py-8 text-center text-sm text-zinc-500">
        No spots match your search.
        <br />
        Try different keywords or filters.
      </p>
    );

  // ---- Filter chip component ----
  function FilterChip({
    label,
    filter,
    count: chipCount,
  }: {
    label: string;
    filter: FilterType;
    count?: number;
  }) {
    const isActive = activeFilter === filter;
    return (
      <button
        onClick={() => setActiveFilter(filter)}
        className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
          isActive
            ? "bg-blue-500 text-white"
            : "border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
        }`}
      >
        {label}
        {chipCount !== undefined && chipCount > 0 && (
          <span className="ml-1 opacity-70">({chipCount})</span>
        )}
      </button>
    );
  }

  // ---- Search and filter UI ----
  function renderSearchAndFilters() {
    return (
      <div className="flex-shrink-0 space-y-3 border-b border-white/10 px-4 pb-3">
        {/* Search input */}
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search spots..."
            className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder-zinc-500 outline-none transition-colors focus:border-blue-500/50 focus:bg-white/10"
          />
          {searchText && (
            <button
              onClick={() => setSearchText("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Clear search"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2">
          <FilterChip label="All" filter="all" />
          <FilterChip label="Official" filter="official" />
          <FilterChip label="User" filter="user" />
          <FilterChip label="Skateparks" filter="skatepark" />
          <FilterChip label="Street" filter="street" />
        </div>
      </div>
    );
  }

  // ---- Render grouped spots list ----
  function renderSpotsList(closeOnClick: boolean) {
    if (filteredSpots.length === 0) return emptyMessage;

    return groupedSpots.sortedKeys.map((groupKey) => {
      const groupSpots = groupedSpots.groups.get(groupKey)!;

      return (
        <div key={groupKey} className="border-b border-white/5 last:border-0">
          {/* Area header */}
          <div className="sticky top-0 bg-zinc-800/90 px-4 py-2 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              {groupKey}
            </p>
          </div>

          {/* Spots in this group */}
          {groupSpots.map((spot) => renderSpotRow(spot, closeOnClick))}
        </div>
      );
    });
  }

  const headerCountText =
    filteredSpots.length !== count
      ? `${filteredSpots.length} of ${count} spot${count !== 1 ? "s" : ""}`
      : `${count} spot${count !== 1 ? "s" : ""} visible`;

  return (
    <>
      {/* ==============================================================
          MOBILE LAYOUT  (visible below md breakpoint)
          ============================================================== */}

      {/* Collapsed pill — sits above the mobile bottom dock.
          Uses right-20 to avoid overlapping the Locate Me button
          which lives at bottom-28 right-4.
          Hidden while the sheet is open.
          pointer-events-none on the outer div means transparent areas
          of this container do NOT block map taps.  pointer-events-auto
          on the button re-enables interaction only on the visible pill. */}
      {!isOpen && (
        <div className="pointer-events-none fixed bottom-[100px] left-4 right-20 z-[450] md:hidden">
          <button
            onClick={() => setIsOpen(true)}
            aria-label={`${count} spots in view — tap to expand`}
            className="pointer-events-auto flex w-full items-center justify-between rounded-2xl border border-white/10 bg-zinc-900/90 px-4 py-3 shadow-xl backdrop-blur"
          >
            <span className="text-sm font-medium text-white">
              🛹&nbsp;
              {filteredSpots.length !== count
                ? `${filteredSpots.length} of ${count}`
                : `${count}`}{" "}
              spot{count !== 1 ? "s" : ""}
            </span>
            {/* Chevron up — indicates panel opens upward */}
            <svg
              className="text-zinc-400"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>
        </div>
      )}

      {/* Backdrop — darkens the map while the sheet is open.
          Tapping it collapses the sheet. */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[440] bg-black/40 md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Expanded bottom sheet */}
      {isOpen && (
        <div className="fixed inset-x-0 bottom-0 z-[450] flex h-[75vh] flex-col rounded-t-2xl border-t border-white/10 bg-zinc-900 shadow-2xl md:hidden">
          {/* Sheet header — drag handle + count + close button */}
          <div className="flex flex-shrink-0 items-center justify-between border-b border-white/10 px-4 pb-3 pt-4">
            <div>
              {/* Visual drag-handle bar */}
              <div className="mb-2 h-1 w-10 rounded-full bg-zinc-700" />
              <p className="text-sm font-semibold text-white">Spots in view</p>
              <p className="mt-0.5 text-xs text-zinc-400">{headerCountText}</p>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close panel"
              className="rounded-full p-2 transition-colors hover:bg-white/10"
            >
              <svg
                className="text-zinc-400"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Search and filters */}
          {renderSearchAndFilters()}

          {/* Scrollable spot list */}
          <div className="flex-1 overflow-y-auto">
            {renderSpotsList(true)}
          </div>
        </div>
      )}

      {/* ==============================================================
          DESKTOP LAYOUT  (visible at md and above)
          ============================================================== */}

      {/* Right-side floating panel — always visible, never collapses.
          max-h keeps it from overflowing the viewport on short screens.
          The left side is reserved for BottomLeftWidget. */}
      <div
        className="fixed right-4 top-20 z-[450] hidden w-80 flex-col rounded-2xl border border-white/10 bg-zinc-900/85 shadow-2xl backdrop-blur md:flex"
        style={{ maxHeight: "calc(100vh - 160px)" }}
      >
        {/* Panel header */}
        <div className="flex-shrink-0 border-b border-white/10 px-4 py-3">
          <p className="text-sm font-semibold text-white">Spots in view</p>
          <p className="mt-0.5 text-xs text-zinc-400">{headerCountText}</p>
        </div>

        {/* Search and filters */}
        {renderSearchAndFilters()}

        {/* Scrollable spot list */}
        <div className="flex-1 overflow-y-auto">
          {renderSpotsList(false)}
        </div>
      </div>
    </>
  );
}
