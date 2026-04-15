// ============================================================
// BottomLeftWidget — floating action buttons on the map.
//
// Currently contains:
//   • "Locate Me"  — flies the map to the user's GPS position
//   • "Add Spot"   — placeholder button for V2
//   • "Profile"    — navigates to the profile hub
//
// The widget sits in the bottom-left corner and is designed to
// be thumb-reachable on mobile.
// ============================================================

"use client";

import { useRouter } from "next/navigation";

export default function BottomLeftWidget() {
  const router = useRouter();
  const handleLocateMe = () => {
    // Call the function exposed by MapView on `window`
    const fn = (window as unknown as Record<string, unknown>).__goskate_locateMe;
    if (typeof fn === "function") fn();
  };

  const handleAddSpot = () => {
    // Placeholder — will be implemented in a future version
    alert("Add Spot coming soon!");
  };

  return (
    <div className="fixed bottom-6 left-4 z-50 flex flex-col gap-3">
      {/* ---- Locate Me ---- */}
      <button
        onClick={handleLocateMe}
        aria-label="Locate me"
        className="flex h-12 w-12 items-center justify-center rounded-full
                   bg-zinc-900/80 text-white shadow-lg backdrop-blur
                   active:scale-95 transition-transform"
      >
        {/* Simple crosshair icon (SVG) */}
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

      {/* ---- Add Spot (placeholder) ---- */}
      <button
        onClick={handleAddSpot}
        aria-label="Add spot"
        className="flex h-12 w-12 items-center justify-center rounded-full
                   bg-green-500/90 text-white shadow-lg backdrop-blur
                   active:scale-95 transition-transform"
      >
        {/* Plus icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
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

      {/* ---- Profile ---- */}
      <button
        onClick={() => router.push("/profile")}
        aria-label="Profile"
        className="flex h-12 w-12 items-center justify-center rounded-full
                   bg-zinc-900/80 text-white shadow-lg backdrop-blur
                   active:scale-95 transition-transform"
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
    </div>
  );
}
