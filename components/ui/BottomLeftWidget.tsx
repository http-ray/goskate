// ============================================================
// BottomLeftWidget — responsive floating controls on the map.
//
// Layout behavior:
//   • Mobile: floating bottom dock with Profile / Add / Settings,
//             plus a separate Locate Me button above the dock.
//   • Desktop: floating toolbar on the left with Profile / Add / Settings,
//              and a separate Locate Me button on the left side.
//
// Actions currently include:
//   • "Locate Me"  — flies the map to the user's GPS position
//   • "Add Spot"   — opens the spot submission modal
//   • "Profile"    — navigates to the profile hub
//   • "Settings"   — navigates to profile settings
// ============================================================

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AddSpotFlow from "@/components/ui/AddSpotFlow";

interface BottomLeftWidgetProps {
  mapCenter: { lat: number; lng: number };
  onLocationPick?: (callback: (lat: number, lng: number) => void) => void;
  onMapMove?: (lat: number, lng: number) => void;
}

export default function BottomLeftWidget({
  mapCenter,
  onLocationPick,
  onMapMove,
}: BottomLeftWidgetProps) {
  const router = useRouter();
  const [showAddSpotModal, setShowAddSpotModal] = useState(false);

  const handleLocateMe = () => {
    // Call the function exposed by MapView on `window`
    const fn = (window as unknown as Record<string, unknown>).__goskate_locateMe;
    if (typeof fn === "function") fn();
  };

  const handleAddSpot = () => {
    setShowAddSpotModal(true);
  };

  const controlButtonClass =
    "flex h-12 w-12 items-center justify-center rounded-full border border-line bg-elevated text-ink shadow-lg transition-colors hover:bg-elevated active:scale-95";

  return (
    <>
      {/* Add Spot Flow */}
      <AddSpotFlow
        isOpen={showAddSpotModal}
        onClose={() => setShowAddSpotModal(false)}
        mapCenter={mapCenter}
        onLocationPick={onLocationPick}
        onMapMove={onMapMove}
      />

      {/* Desktop: left floating toolbar */}
      <div className="fixed left-4 top-1/2 z-50 hidden -translate-y-1/2 flex-col gap-3 rounded-3xl border border-line bg-surface p-2 shadow-xl md:flex">
        <button
          onClick={() => router.push("/profile")}
          aria-label="Profile"
          className={controlButtonClass}
        >
          {/* User icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </button>

        <button
          onClick={handleAddSpot}
          aria-label="Add spot"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-on-accent shadow-lg shadow-accent/20 transition-colors hover:bg-accent-press active:scale-95"
        >
          {/* Plus icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        <button
          onClick={() => router.push("/profile/settings")}
          aria-label="Filters and settings"
          className={controlButtonClass}
        >
          {/* Sliders icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="4" y1="21" x2="4" y2="14" />
            <line x1="4" y1="10" x2="4" y2="3" />
            <line x1="12" y1="21" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12" y2="3" />
            <line x1="20" y1="21" x2="20" y2="16" />
            <line x1="20" y1="12" x2="20" y2="3" />
            <line x1="1" y1="14" x2="7" y2="14" />
            <line x1="9" y1="8" x2="15" y2="8" />
            <line x1="17" y1="16" x2="23" y2="16" />
          </svg>
        </button>
      </div>

      {/* Mobile: current location button sits above the bottom dock */}
      <button
        onClick={handleLocateMe}
        aria-label="Locate me"
        className="fixed bottom-28 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-elevated text-ink shadow-lg transition-colors hover:bg-elevated active:scale-95 md:hidden"
      >
        {/* Crosshair icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <line x1="12" y1="2" x2="12" y2="6" />
          <line x1="12" y1="18" x2="12" y2="22" />
          <line x1="2" y1="12" x2="6" y2="12" />
          <line x1="18" y1="12" x2="22" y2="12" />
        </svg>
      </button>

      {/* Desktop: current location button stays on the left map controls */}
      <button
        onClick={handleLocateMe}
        aria-label="Locate me"
        className="fixed left-4 top-6 z-50 hidden h-12 w-12 items-center justify-center rounded-full border border-line bg-elevated text-ink shadow-lg transition-colors hover:bg-elevated active:scale-95 md:flex"
      >
        {/* Crosshair icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <line x1="12" y1="2" x2="12" y2="6" />
          <line x1="12" y1="18" x2="12" y2="22" />
          <line x1="2" y1="12" x2="6" y2="12" />
          <line x1="18" y1="12" x2="22" y2="12" />
        </svg>
      </button>

      {/* Mobile: floating bottom dock with thumb-friendly controls */}
      <div className="fixed inset-x-4 bottom-4 z-50 md:hidden">
        <div className="grid grid-cols-3 items-end rounded-3xl border border-line bg-surface px-4 pb-3 pt-2 shadow-xl">
          <button
            onClick={() => router.push("/profile")}
            aria-label="Profile"
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-elevated text-ink shadow-md transition-colors hover:bg-line/40 active:scale-95"
          >
            {/* User icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </button>

          <button
            onClick={handleAddSpot}
            aria-label="Add spot"
            className="mx-auto -mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-accent text-on-accent shadow-xl shadow-accent/25 ring-4 ring-base/60 transition-colors hover:bg-accent-press active:scale-95"
          >
            {/* Plus icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>

          <button
            onClick={() => router.push("/profile/settings")}
            aria-label="Filters and settings"
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-elevated text-ink shadow-md transition-colors hover:bg-line/40 active:scale-95"
          >
            {/* Sliders icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="4" y1="21" x2="4" y2="14" />
              <line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" />
              <line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" />
              <line x1="9" y1="8" x2="15" y2="8" />
              <line x1="17" y1="16" x2="23" y2="16" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
