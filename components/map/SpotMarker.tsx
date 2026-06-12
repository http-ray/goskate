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
// Marker style:
//   • Every spot is the GoSkate skate icon (public/images/skateicon.png).
//   • Official spots render slightly larger than user spots so the
//     two are still distinguishable at a glance.
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
 * Build a Leaflet DivIcon — the GoSkate skate icon.
 * The outer wrapper is 44×44 px so it's easy to tap on mobile;
 * official spots render a touch larger than user spots.
 */
function createSpotIcon(spot: Spot): L.DivIcon {
  const isOfficial = spot.source === "official";
  // Larger, easier-to-see icons — official spots a touch bigger.
  const iconSize = isOfficial ? 40 : 34;

  return L.divIcon({
    className: "", // reset Leaflet's default styling
    iconSize: [48, 48],
    iconAnchor: [24, 24], // center the icon on the coordinate
    popupAnchor: [0, -24], // popup opens above the marker
    html: `
      <div style="
        display:flex;align-items:center;justify-content:center;
        width:48px;height:48px;cursor:pointer;
      ">
        <img src="/images/skateicon.png" alt="" style="
          width:${iconSize}px;height:${iconSize}px;object-fit:contain;
          filter:drop-shadow(0 1px 3px rgba(0,0,0,0.45));
        " />
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
