"use client";

import { useRouter } from "next/navigation";
import { Spot } from "@/types/spot";

interface SpotPopupProps {
  spot: Spot;
  onAddClip: (spot: Spot) => void;
}

export default function SpotPopup({ spot, onAddClip }: SpotPopupProps) {
  const router = useRouter();

  const handleDirections = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${spot.latitude},${spot.longitude}&travelmode=driving`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleViewSpot = () => {
    router.push(`/spots/${spot.id}`);
  };

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
      {/* Spot name */}
      <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: 15, color: "#F3F5F8" }}>
        {spot.name}
      </p>

      {/* Badges */}
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

      {/* Clips count (only shown when populated) */}
      {spot.clipsCount !== undefined && spot.clipsCount > 0 && (
        <div style={{ marginTop: 6, fontSize: 13, color: "#A2A9B8" }}>
          <span>🎬 {spot.clipsCount} clip{spot.clipsCount === 1 ? "" : "s"}</span>
        </div>
      )}

      {/* Action buttons: Directions full-width, then View Spot | Add Clip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 6,
          marginTop: 10,
        }}
      >
        <button
          onClick={handleDirections}
          style={{
            ...btnBase,
            gridColumn: "1 / -1",
            background: "#F4E7D0",
            color: "#161310",
          }}
        >
          📍 Directions
        </button>

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
      </div>
    </div>
  );
}
