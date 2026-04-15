// ============================================================
// SpotMarker — renders a single marker + popup on the Leaflet map.
//
// How it works:
//   1. Receives a Spot object plus callbacks for check-in & add-clip.
//   2. Creates a Leaflet DivIcon (coloured circle) so we can
//      style official vs user spots differently.
//   3. Wraps a react-leaflet <Marker> with a <Popup> inside it.
//   4. The popup stays open until the user taps elsewhere
//      (Leaflet's default autoClose behaviour).
//
// Marker colours:
//   • Official spots → green (#22c55e), slightly larger
//   • User spots     → amber (#f59e0b), slightly smaller
// ============================================================

"use client";

import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { Spot } from "@/types/spot";
import SpotPopup from "./SpotPopup";

interface SpotMarkerProps {
  spot: Spot;
  /** Extra check-in count for this spot (frontend-only) */
  checkInCount: number;
  /** Whether the current user is checked in */
  isCheckedIn: boolean;
  /** Toggle check-in callback */
  onToggleCheckIn: (spotId: string) => void;
  /** Open add-clip modal callback */
  onAddClip: (spot: Spot) => void;
}

/**
 * Build a Leaflet DivIcon — a small coloured circle.
 * The outer wrapper is 44×44 px so it's easy to tap on mobile.
 */
function createSpotIcon(spot: Spot): L.DivIcon {
  const isOfficial = spot.source === "official";
  const color = isOfficial ? "#22c55e" : "#f59e0b";
  const dotSize = isOfficial ? 18 : 14;

  return L.divIcon({
    className: "", // reset Leaflet's default styling
    iconSize: [44, 44],
    iconAnchor: [22, 22], // center the icon on the coordinate
    popupAnchor: [0, -22], // popup opens above the marker
    html: `
      <div style="
        display:flex;align-items:center;justify-content:center;
        width:44px;height:44px;cursor:pointer;
      ">
        <div style="
          width:${dotSize}px;height:${dotSize}px;
          background:${color};border-radius:50%;
          border:2px solid #fff;
          box-shadow:0 0 6px rgba(0,0,0,0.4);
        "></div>
      </div>
    `,
  });
}

export default function SpotMarker({
  spot,
  checkInCount,
  isCheckedIn,
  onToggleCheckIn,
  onAddClip,
}: SpotMarkerProps) {
  const icon = createSpotIcon(spot);

  return (
    <Marker position={[spot.latitude, spot.longitude]} icon={icon}>
      {/* Popup content — now includes action buttons */}
      <Popup
        closeButton={true}
        autoPan={true}
        maxWidth={280}
        className="goskate-popup"
      >
        <SpotPopup
          spot={spot}
          checkInCount={checkInCount}
          isCheckedIn={isCheckedIn}
          onToggleCheckIn={onToggleCheckIn}
          onAddClip={onAddClip}
        />
      </Popup>
    </Marker>
  );
}
