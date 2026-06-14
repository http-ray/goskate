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

export type FilterType = "all" | "skatepark" | "street";

interface VisibleSpotsPanelProps {
  spots: Spot[];
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  onSpotClick: (spot: Spot) => void;
}

export default function VisibleSpotsPanel({
  spots,
  activeFilter,
  onFilterChange,
  onSpotClick,
}: VisibleSpotsPanelProps) {
  // Controls whether the mobile bottom sheet is open or collapsed.
  const [isOpen, setIsOpen] = useState(false);

  // Search state — filter chip state is owned by MapView so the map can react to it
  const [searchText, setSearchText] = useState("");

  // Collapsible area sections. Every city/area starts COLLAPSED — only the
  // keys listed here are expanded. While searching we force-expand matching
  // sections so results are always visible (see renderSpotsList).
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());
  const toggleArea = (key: string) =>
    setExpandedAreas((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const count = spots.length;

  // ---- Search logic ----
  // Chip-filter is applied upstream (MapView) so `spots` already matches the
  // active filter. Here we only apply the search text on top of that.
  const filteredSpots = useMemo(() => {
    if (!searchText.trim()) return spots;
    const query = searchText.toLowerCase().trim();
    return spots.filter((s) => {
      return (
        s.name.toLowerCase().includes(query) ||
        s.areaText?.toLowerCase().includes(query) ||
        s.type.toLowerCase().includes(query) ||
        s.source.toLowerCase().includes(query)
      );
    });
  }, [spots, searchText]);

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
        className="w-full border-b border-line-soft px-4 py-3 text-left transition-colors last:border-0 hover:bg-white/5 active:bg-white/10"
      >
        <div className="flex items-start gap-3">
          {/* Colour dot — green for official, amber for user-added */}
          <div
            className={`mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ${
              isOfficial ? "bg-success" : "bg-warning"
            }`}
          />

          <div className="min-w-0 flex-1">
            {/* Spot name — truncated when too long */}
            <p className="truncate text-sm font-medium text-ink">
              {spot.name}
            </p>

            {/* Type + source + clips badges */}
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {/* Spot type */}
              <span
                className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                  isSkatepark
                    ? "bg-info/15 text-info"
                    : "bg-elevated text-muted"
                }`}
              >
                {isSkatepark ? "Skatepark" : "Street"}
              </span>

              {/* Source */}
              <span
                className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                  isOfficial
                    ? "bg-success/15 text-success"
                    : "bg-warning/15 text-warning"
                }`}
              >
                {isOfficial
                  ? "Official"
                  : spot.submitterUsername
                  ? `User: @${spot.submitterUsername}`
                  : "User"}
              </span>

              {/* Clips count — only shown when the spot has clips */}
              {spot.clipsCount !== undefined && spot.clipsCount > 0 && (
                <span className="text-[11px] text-muted">
                  🎬 {spot.clipsCount}
                </span>
              )}
            </div>
          </div>

          {/* Right-pointing chevron — signals the row is tappable */}
          <svg
            className="mt-0.5 flex-shrink-0 text-faint"
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
  const emptyMessage = searchText.trim() ? (
    <p className="px-4 py-8 text-center text-sm text-faint">
      No spots match your search.
      <br />
      Try different keywords or filters.
    </p>
  ) : activeFilter !== "all" ? (
    <p className="px-4 py-8 text-center text-sm text-faint">
      No {activeFilter} spots in view.
      <br />
      Pan or zoom out, or try a different filter.
    </p>
  ) : (
    <p className="px-4 py-8 text-center text-sm text-faint">
      No spots visible here.
      <br />
      Pan or zoom out to find more.
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
        onClick={() => onFilterChange(filter)}
        className={isActive ? "gs-chip-active" : "gs-chip"}
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
      <div className="flex-shrink-0 space-y-3 border-b border-line px-4 pb-3">
        {/* Search input */}
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
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
            className="w-full rounded-xl border border-line-soft bg-field py-2 pl-9 pr-9 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-accent/50 focus:bg-elevated"
          />
          {searchText && (
            <button
              onClick={() => setSearchText("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-faint transition-colors hover:bg-white/5 hover:text-ink"
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
          <FilterChip label="Skateparks" filter="skatepark" />
          <FilterChip label="Street" filter="street" />
        </div>
      </div>
    );
  }

  // ---- Render grouped spots list ----
  function renderSpotsList(closeOnClick: boolean) {
    if (filteredSpots.length === 0) return emptyMessage;

    // While searching, force every matching section open so results show.
    // Otherwise sections stay collapsed until the user taps them.
    const isSearching = searchText.trim().length > 0;

    return groupedSpots.sortedKeys.map((groupKey) => {
      const groupSpots = groupedSpots.groups.get(groupKey)!;
      const isExpanded = isSearching || expandedAreas.has(groupKey);

      return (
        <div key={groupKey} className="border-b border-line-soft last:border-0">
          {/* Collapsible area header — click to expand/collapse */}
          <button
            type="button"
            onClick={() => toggleArea(groupKey)}
            aria-expanded={isExpanded}
            className="flex w-full items-center justify-between gap-2 bg-elevated px-4 py-2.5 text-left transition-colors hover:bg-line/30"
          >
            <span className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
              {groupKey}
            </span>
            <span className="flex flex-shrink-0 items-center gap-2">
              <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-muted">
                {groupSpots.length}
              </span>
              <svg
                className="text-faint transition-transform"
                style={{ transform: isExpanded ? "rotate(90deg)" : "none" }}
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
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </span>
          </button>

          {/* Spots in this group — hidden when the section is collapsed */}
          {isExpanded &&
            groupSpots.map((spot) => renderSpotRow(spot, closeOnClick))}
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
            className="pointer-events-auto flex w-full items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3 shadow-xl"
          >
            <span className="text-sm font-medium text-ink">
              🛹&nbsp;
              {filteredSpots.length !== count
                ? `${filteredSpots.length} of ${count}`
                : `${count}`}{" "}
              spot{count !== 1 ? "s" : ""}
            </span>
            {/* Chevron up — indicates panel opens upward */}
            <svg
              className="text-muted"
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
        <div className="fixed inset-x-0 bottom-0 z-[450] flex h-[75vh] flex-col rounded-t-2xl border-t border-line bg-surface shadow-2xl md:hidden">
          {/* Sheet header — drag handle + count + close button */}
          <div className="flex flex-shrink-0 items-center justify-between border-b border-line px-4 pb-3 pt-4">
            <div>
              {/* Visual drag-handle bar */}
              <div className="mb-2 h-1 w-10 rounded-full bg-line" />
              <p className="text-sm font-semibold text-ink">Spots in view</p>
              <p className="mt-0.5 text-xs text-muted">{headerCountText}</p>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close panel"
              className="rounded-full p-2 transition-colors hover:bg-white/10"
            >
              <svg
                className="text-muted"
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
        className="fixed right-4 top-20 z-[450] hidden w-80 flex-col rounded-2xl border border-line bg-surface shadow-2xl md:flex"
        style={{ maxHeight: "calc(100vh - 160px)" }}
      >
        {/* Panel header */}
        <div className="flex-shrink-0 border-b border-line px-4 py-3">
          <p className="text-sm font-semibold text-ink">Spots in view</p>
          <p className="mt-0.5 text-xs text-muted">{headerCountText}</p>
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
