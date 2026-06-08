"use client";

// ============================================================
// AddSpotFlow — Multi-step spot submission (NO PAID API CALLS)
//
// Flow:
//   Step 1: Choose Location (current location / pick on map)
//   Step 2: Spot Details (name, type, description, tags, area text)
//   Step 3: Review & Submit
//
// Location selection uses ONLY free methods:
//   - Use Current Location: Browser Geolocation API (free)
//   - Pick on Map: Leaflet click handler (free)
//   - Area/Address field: Manual text input, no geocoding (free)
//
// The modal minimizes when "Pick on Map" is active to allow
// map interaction, then reopens with the selected location.
// ============================================================

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { submitSpot, checkNearbySpots } from "@/lib/spotsService";
import type { SpotSubmission } from "@/types/spot";

interface AddSpotFlowProps {
  isOpen: boolean;
  onClose: () => void;
  mapCenter: { lat: number; lng: number };
  onLocationPick?: (callback: (lat: number, lng: number) => void) => void;
  onMapMove?: (lat: number, lng: number) => void;
}

const OBSTACLE_OPTIONS = [
  "rail",
  "ledge",
  "stairs",
  "gap",
  "flatground",
  "bowl",
  "manual pad",
];

type Step = "location" | "details" | "success";

export default function AddSpotFlow({
  isOpen,
  onClose,
  mapCenter,
  onLocationPick,
  onMapMove,
}: AddSpotFlowProps) {
  const { user } = useAuth();

  // ---- Step state ----
  const [step, setStep] = useState<Step>("location");
  const [isMinimized, setIsMinimized] = useState(false);

  // ---- Location state ----
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLabel, setLocationLabel] = useState<string>("");

  // ---- Form state ----
  const [spotName, setSpotName] = useState("");
  const [spotType, setSpotType] = useState<"skatepark" | "street">("skatepark");
  const [description, setDescription] = useState("");
  const [selectedObstacles, setSelectedObstacles] = useState<string[]>([]);
  const [areaText, setAreaText] = useState("");

  // ---- Submission state ----
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nearbySpots, setNearbySpots] = useState<number>(0);

  // ---- Reset on open ----
  useEffect(() => {
    if (isOpen) {
      setStep("location");
      setLocation(null);
      setLocationLabel("");
      setSpotName("");
      setDescription("");
      setSelectedObstacles([]);
      setAreaText("");
      setError(null);
      setIsMinimized(false);
    }
  }, [isOpen]);

  // ---- Location handlers ----
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLocation({ lat, lng });
        setLocationLabel("Current location");
        if (onMapMove) onMapMove(lat, lng);
      },
      (err) => {
        setError("Could not get your location. Please try another method.");
      }
    );
  };

  const handlePickOnMap = () => {
    if (!onLocationPick) {
      setError("Map picker not available.");
      return;
    }

    setIsMinimized(true);
    onLocationPick((lat: number, lng: number) => {
      setLocation({ lat, lng });
      setLocationLabel("Location from map");
      setIsMinimized(false);
    });
  };

  const handleNextToDetails = () => {
    if (!location) {
      setError("Please select a location first.");
      return;
    }
    setStep("details");
    setError(null);
  };

  const handleBackToLocation = () => {
    setStep("location");
    setError(null);
  };

  // ---- Form handlers ----
  const toggleObstacle = (obstacle: string) => {
    setSelectedObstacles((prev) =>
      prev.includes(obstacle)
        ? prev.filter((o) => o !== obstacle)
        : [...prev, obstacle]
    );
  };

  const handleSubmit = async () => {
    if (!user || !location) return;

    setSubmitting(true);
    setError(null);

    try {
      // Check for nearby duplicates
      const nearby = await checkNearbySpots(location.lat, location.lng, 100);
      setNearbySpots(nearby.length);

      const submission: SpotSubmission = {
        display_name: spotName.trim(),
        type: spotType,
        latitude: location.lat,
        longitude: location.lng,
        description: description.trim() || undefined,
        obstacle_tags: selectedObstacles,
        area_text: areaText.trim() || undefined,
      };

      await submitSpot(user.id, submission);

      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit spot.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseAndReset = () => {
    setStep("location");
    setLocation(null);
    setLocationLabel("");
    setSpotName("");
    setDescription("");
    setSelectedObstacles([]);
    setAreaText("");
    setError(null);
    onClose();
  };

  // ---- Auth check ----
  if (!user) {
    return (
      <div
        className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm transition-opacity ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
          <h2 className="text-xl font-bold text-white">Login Required</h2>
          <p className="mt-2 text-sm text-zinc-400">
            You need to be signed in to add a spot.
          </p>
          <button
            onClick={onClose}
            className="mt-4 w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition-transform active:scale-[0.99]"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!isOpen) return null;

  // ---- Minimized state (picking on map) ----
  if (isMinimized) {
    return (
      <div className="fixed inset-x-4 bottom-4 z-[9999] md:left-auto md:right-4 md:w-96">
        <div className="rounded-3xl border border-blue-500/50 bg-blue-500/20 px-6 py-4 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white">
                Tap the map to place your spot
              </p>
              <p className="text-xs text-blue-200">Choose the exact location</p>
            </div>
            <button
              onClick={() => setIsMinimized(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
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
          </div>
        </div>
      </div>
    );
  }

  // ---- Success state ----
  if (step === "success") {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-3xl border border-green-500/30 bg-zinc-950 p-8 shadow-2xl">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-green-500"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white">Submitted for Review!</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Your spot will appear on the map after it's approved by our team.
            </p>
            {nearbySpots > 0 && (
              <p className="mt-3 text-xs text-yellow-400">
                ⚠️ {nearbySpots} nearby spot(s) detected — this may be reviewed for
                duplicates.
              </p>
            )}
            <button
              onClick={handleCloseAndReset}
              className="mt-6 w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition-transform active:scale-[0.99]"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Step 1: Location ----
  if (step === "location") {
    return (
      <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/80 px-4 backdrop-blur-sm md:items-center">
        <div className="w-full max-w-lg rounded-t-3xl border border-white/10 bg-zinc-950 shadow-2xl md:rounded-3xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
            <div>
              <h2 className="text-xl font-bold text-white">Add a Spot</h2>
              <p className="text-xs text-zinc-500">Step 1: Choose Location</p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
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
          </div>

          {/* Content */}
          <div className="max-h-[70vh] overflow-y-auto p-6">
            <div className="space-y-4">
              {/* Selected location display */}
              {location && (
                <div className="rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-green-400"
                    >
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-400">
                        Location selected
                      </p>
                      <p className="text-xs text-green-300">{locationLabel}</p>
                    </div>
                    <button
                      onClick={() => {
                        setLocation(null);
                        setLocationLabel("");
                      }}
                      className="text-xs text-zinc-400 hover:text-white"
                    >
                      Change
                    </button>
                  </div>
                </div>
              )}

              {/* Location options */}
              <div className="space-y-3">
                <button
                  onClick={handleUseCurrentLocation}
                  className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-4 text-left transition-colors hover:bg-zinc-800"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-blue-400"
                      >
                        <circle cx="12" cy="12" r="4" />
                        <line x1="12" y1="2" x2="12" y2="6" />
                        <line x1="12" y1="18" x2="12" y2="22" />
                        <line x1="2" y1="12" x2="6" y2="12" />
                        <line x1="18" y1="12" x2="22" y2="12" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        Use Current Location
                      </p>
                      <p className="text-xs text-zinc-500">
                        Use your device's GPS
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={handlePickOnMap}
                  className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-4 text-left transition-colors hover:bg-zinc-800"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/20">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-green-400"
                      >
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Pick on Map</p>
                      <p className="text-xs text-zinc-500">
                        Tap the map to choose exact location
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              {/* Error message */}
              {error && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              )}

              {/* Next button */}
              <button
                onClick={handleNextToDetails}
                disabled={!location}
                className="w-full rounded-2xl bg-green-500 px-4 py-3 text-sm font-semibold text-white transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next: Spot Details
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Step 2: Details ----
  if (step === "details") {
    return (
      <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/80 px-4 backdrop-blur-sm md:items-center">
        <div className="w-full max-w-lg rounded-t-3xl border border-white/10 bg-zinc-950 shadow-2xl md:rounded-3xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
            <div>
              <h2 className="text-xl font-bold text-white">Spot Details</h2>
              <p className="text-xs text-zinc-500">Step 2: Describe the spot</p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
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
          </div>

          {/* Content */}
          <div className="max-h-[70vh] overflow-y-auto p-6">
            <div className="space-y-4">
              {/* Spot name */}
              <div>
                <label className="block text-sm font-medium text-zinc-300">
                  Spot Name *
                </label>
                <input
                  type="text"
                  value={spotName}
                  onChange={(e) => setSpotName(e.target.value)}
                  placeholder="e.g. Downtown Ledges"
                  required
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition-colors focus:border-zinc-500"
                />
              </div>

              {/* Spot type */}
              <div>
                <label className="block text-sm font-medium text-zinc-300">
                  Type *
                </label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSpotType("skatepark")}
                    className={`rounded-2xl px-4 py-3 text-sm font-medium transition-colors ${
                      spotType === "skatepark"
                        ? "bg-white text-black"
                        : "border border-white/10 bg-zinc-900 text-white hover:bg-zinc-800"
                    }`}
                  >
                    Skatepark
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpotType("street")}
                    className={`rounded-2xl px-4 py-3 text-sm font-medium transition-colors ${
                      spotType === "street"
                        ? "bg-white text-black"
                        : "border border-white/10 bg-zinc-900 text-white hover:bg-zinc-800"
                    }`}
                  >
                    Street Spot
                  </button>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-zinc-300">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the spot..."
                  rows={3}
                  className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition-colors focus:border-zinc-500"
                />
              </div>

              {/* Obstacle tags */}
              <div>
                <label className="block text-sm font-medium text-zinc-300">
                  Obstacles
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {OBSTACLE_OPTIONS.map((obstacle) => (
                    <button
                      key={obstacle}
                      type="button"
                      onClick={() => toggleObstacle(obstacle)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                        selectedObstacles.includes(obstacle)
                          ? "bg-green-500 text-white"
                          : "border border-white/10 bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
                      }`}
                    >
                      {obstacle}
                    </button>
                  ))}
                </div>
              </div>

              {/* Area/address */}
              <div>
                <label className="block text-sm font-medium text-zinc-300">
                  Area / Address (optional)
                </label>
                <input
                  type="text"
                  value={areaText}
                  onChange={(e) => setAreaText(e.target.value)}
                  placeholder="e.g. Downtown, near 5th St"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition-colors focus:border-zinc-500"
                />
              </div>

              {/* Error message */}
              {error && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleBackToLocation}
                  className="flex-1 rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-white transition-colors hover:bg-zinc-800"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !spotName.trim()}
                  className="flex-1 rounded-2xl bg-green-500 px-4 py-3 text-sm font-semibold text-white transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit for Review"}
                </button>
              </div>

              <p className="text-center text-xs text-zinc-500">
                Your submission will be reviewed before appearing on the map.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
