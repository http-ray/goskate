// ============================================================
// SpotPopup — the content shown inside a marker's popup bubble.
//
// Shows spot info (name, type, source, clips, active skaters)
// plus a 2×2 grid of action buttons:
//   • Get Directions — opens Google Maps in a new tab
//   • View Spot      — navigates to /spots/[id]
//   • Add Clip       — tells the parent to open the AddClipModal
//   • Check In       — toggles a local checked-in state
// ============================================================

"use client";

import { useRouter } from "next/navigation";
import { Spot } from "@/types/spot";

interface SpotPopupProps {
  spot: Spot;
  /** How many extra skaters have checked in (frontend-only count) */
  checkInCount: number;
  /** Whether the current user is checked in to this spot */
  isCheckedIn: boolean;
  /** Toggle check-in for this spot */
  onToggleCheckIn: (spotId: string) => void;
  /** Open the "Add Clip" modal for this spot */
  onAddClip: (spot: Spot) => void;
}

export default function SpotPopup({
  spot,
  checkInCount,
  isCheckedIn,
  onToggleCheckIn,
  onAddClip,
}: SpotPopupProps) {
  const router = useRouter();

  // ---- Actions ----

  /** Open Google Maps walking directions to this spot */
  const handleDirections = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${spot.latitude},${spot.longitude}&travelmode=walking`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  /** Navigate to the spot detail page */
  const handleViewSpot = () => {
    router.push(`/spots/${spot.id}`);
  };

  // Compute displayed active skaters (base value + check-ins)
  const displayedSkaters = (spot.activeSkaters ?? 0) + checkInCount;

  // ---- Shared button style (inline so it works inside Leaflet popup) ----
  const btnBase: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: "6px 0",
    borderRadius: 8,
    border: "none",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
    width: "100%",
  };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", minWidth: 200 }}>
      {/* ---- Spot name ---- */}
      <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: 15, color: "#F3F5F8" }}>
        {spot.name}
      </p>

      {/* ---- Badges row ---- */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <span
          style={{
            background:
              spot.type === "skatepark"
                ? "rgba(91,168,255,0.18)"
                : "rgba(255,255,255,0.08)",
            color: spot.type === "skatepark" ? "#5BA8FF" : "#A2A9B8",
            padding: "2px 8px",
            borderRadius: 9999,
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {spot.type === "skatepark" ? "Skatepark" : "Street"}
        </span>
        <span
          style={{
            background:
              spot.source === "official"
                ? "rgba(61,214,140,0.18)"
                : "rgba(245,180,69,0.18)",
            color: spot.source === "official" ? "#3DD68C" : "#F5B445",
            padding: "2px 8px",
            borderRadius: 9999,
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {spot.source === "official" ? "Official" : "User"}
        </span>
      </div>

      {/* ---- Stats row ---- */}
      <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 13, color: "#A2A9B8" }}>
        {spot.clipsCount !== undefined && (
          <span>🎬 {spot.clipsCount} clip{spot.clipsCount === 1 ? "" : "s"}</span>
        )}
        {displayedSkaters > 0 && (
          <span>🛹 {displayedSkaters} here</span>
        )}
      </div>

      {/* ---- 2×2 Action buttons ---- */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 6,
          marginTop: 10,
        }}
      >
        {/* Get Directions — primary */}
        <button
          onClick={handleDirections}
          style={{ ...btnBase, background: "#F4E7D0", color: "#161310" }}
        >
          📍 Directions
        </button>

        {/* View Spot — elevated */}
        <button
          onClick={handleViewSpot}
          style={{
            ...btnBase,
            background: "#20232C",
            color: "#F3F5F8",
            border: "1px solid #2A2E3A",
          }}
        >
          👁️ View Spot
        </button>

        {/* Add Clip — elevated */}
        <button
          onClick={() => onAddClip(spot)}
          style={{
            ...btnBase,
            background: "#20232C",
            color: "#F3F5F8",
            border: "1px solid #2A2E3A",
          }}
        >
          🎬 Add Clip
        </button>

        {/* Check In / Check Out */}
        <button
          onClick={() => onToggleCheckIn(spot.id)}
          style={{
            ...btnBase,
            background: isCheckedIn ? "rgba(244,84,78,0.18)" : "rgba(61,214,140,0.18)",
            color: isCheckedIn ? "#F4544E" : "#3DD68C",
          }}
        >
          {isCheckedIn ? "✖ Check Out" : "📌 Check In"}
        </button>
      </div>
    </div>
  );
}
