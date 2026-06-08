"use client";

// ============================================================
// AddSpotModal — user spot submission flow
//
// This modal opens when a logged-in user taps the "+" button
// and chooses "Add Spot".
//
// Flow:
//   1. User selects a location by clicking the map or using map center
//   2. User fills out spot details (name, type, description, tags)
//   3. System checks for nearby duplicates
//   4. User submits; spot is created with status = 'pending'
//   5. Success message confirms submission is awaiting moderation
//
// Props:
//   isOpen        — controls visibility
//   onClose       — callback to close the modal
//   mapCenter     — current map center for default location
//   onLocationPick — callback to enable map click mode
// ============================================================

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { submitSpot, checkNearbySpots } from "@/lib/spotsService";
import type { SpotSubmission } from "@/types/spot";

interface AddSpotModalProps {
  isOpen: boolean;
  onClose: () => void;
  mapCenter: { lat: number; lng: number };
  /** Callback to enable "tap map to choose location" mode */
  onLocationPick?: (callback: (lat: number, lng: number) => void) => void;
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

export default function AddSpotModal({
  isOpen,
  onClose,
  mapCenter,
  onLocationPick,
}: AddSpotModalProps) {
  const { user } = useAuth();

  // ---- Form state ----
  const [spotName, setSpotName] = useState("");
  const [spotType, setSpotType] = useState<"skatepark" | "street">("skatepark");
  const [description, setDescription] = useState("");
  const [selectedObstacles, setSelectedObstacles] = useState<string[]>([]);
  const [areaText, setAreaText] = useState("");

  // ---- Location state ----
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [isPickingLocation, setIsPickingLocation] = useState(false);

  // ---- UI state ----
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [nearbySpots, setNearbySpots] = useState<number>(0);

  // ---- Handlers ----
  const handleUseMapCenter = () => {
    setLocation(mapCenter);
    setIsPickingLocation(false);
  };

  const handlePickOnMap = () => {
    if (!onLocationPick) {
      alert("Map click picker not available.");
      return;
    }

    setIsPickingLocation(true);
    onLocationPick((lat: number, lng: number) => {
      setLocation({ lat, lng });
      setIsPickingLocation(false);
    });
  };

  const toggleObstacle = (obstacle: string) => {
    setSelectedObstacles((prev) =>
      prev.includes(obstacle)
        ? prev.filter((o) => o !== obstacle)
        : [...prev, obstacle]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !location) return;

    setError(null);
    setSubmitting(true);

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

      setSuccess(true);

      // Reset form after 2 seconds and close
      setTimeout(() => {
        resetForm();
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit spot.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSpotName("");
    setSpotType("skatepark");
    setDescription("");
    setSelectedObstacles([]);
    setAreaText("");
    setLocation(null);
    setError(null);
    setSuccess(false);
    setNearbySpots(0);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  // ---- Not logged in ----
  if (!user) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
          <h2 className="text-xl font-bold text-white">Login Required</h2>
          <p className="mt-2 text-sm text-zinc-400">
            You need to be signed in to add a spot.
          </p>
          <button
            onClick={handleClose}
            className="mt-4 w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition-transform active:scale-[0.99]"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // ---- Success state ----
  if (success) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-3xl border border-green-500/30 bg-zinc-950 p-6 shadow-2xl">
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
            <h2 className="text-xl font-bold text-white">Spot Submitted!</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Your spot is awaiting moderation. You'll be notified when it's approved.
            </p>
            {nearbySpots > 0 && (
              <p className="mt-2 text-xs text-yellow-500">
                ⚠️ {nearbySpots} nearby spot(s) detected — this may be reviewed for duplicates.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---- Main form ----
  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/80 px-4 backdrop-blur-sm md:items-center">
      <div className="w-full max-w-lg rounded-t-3xl border border-white/10 bg-zinc-950 shadow-2xl md:rounded-3xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 className="text-xl font-bold text-white">Add a Spot</h2>
          <button
            onClick={handleClose}
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="max-h-[70vh] overflow-y-auto p-6">
          <div className="space-y-5">
            {/* Location picker */}
            <div>
              <label className="block text-sm font-medium text-zinc-300">
                Location
              </label>
              {!location ? (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={handleUseMapCenter}
                    className="flex-1 rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-white transition-colors hover:bg-zinc-800"
                  >
                    Use Map Center
                  </button>
                  {onLocationPick && (
                    <button
                      type="button"
                      onClick={handlePickOnMap}
                      className="flex-1 rounded-2xl bg-blue-500/20 px-4 py-3 text-sm text-blue-400 transition-colors hover:bg-blue-500/30"
                    >
                      {isPickingLocation ? "Tap the Map..." : "Pick on Map"}
                    </button>
                  )}
                </div>
              ) : (
                <div className="mt-2 flex items-center justify-between rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3">
                  <span className="text-sm text-green-400">
                    📍 {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setLocation(null)}
                    className="text-xs text-zinc-500 hover:text-white"
                  >
                    Change
                  </button>
                </div>
              )}
            </div>

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

            {/* Submit button */}
            <button
              type="submit"
              disabled={submitting || !location || !spotName.trim()}
              className="w-full rounded-2xl bg-green-500 px-4 py-3 text-sm font-semibold text-white transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Spot"}
            </button>

            <p className="text-center text-xs text-zinc-500">
              Your submission will be reviewed before appearing on the map.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
