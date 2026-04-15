// ============================================================
// AddClipModal — a placeholder modal for uploading a clip.
//
// Opens as a dark overlay on top of the map. Contains a simple
// form with:
//   • trick name input
//   • caption input
//   • upload placeholder (no real upload yet)
//   • submit button (just shows an alert for now)
//
// This will be replaced with a real upload flow once a backend
// is connected.
// ============================================================

"use client";

import { useState } from "react";
import { Spot } from "@/types/spot";

interface AddClipModalProps {
  spot: Spot;
  onClose: () => void;
}

export default function AddClipModal({ spot, onClose }: AddClipModalProps) {
  const [trickName, setTrickName] = useState("");
  const [caption, setCaption] = useState("");

  const handleSubmit = () => {
    // Placeholder — just show a confirmation for now
    alert(
      `Clip saved (placeholder)!\n\nSpot: ${spot.name}\nTrick: ${trickName || "(none)"}\nCaption: ${caption || "(none)"}`
    );
    onClose();
  };

  return (
    // Full-screen overlay
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose} // tap backdrop to close
    >
      {/* Modal card — stop clicks from closing */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#18181b",
          borderRadius: 16,
          padding: "24px 20px",
          width: "90%",
          maxWidth: 360,
          color: "#fff",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            Add Clip
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "none",
              border: "none",
              color: "#a1a1aa",
              fontSize: 22,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        {/* Spot context */}
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "#a1a1aa" }}>
          Posting to <strong style={{ color: "#fff" }}>{spot.name}</strong>
        </p>

        {/* Trick name */}
        <label style={{ display: "block", marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: "#a1a1aa", display: "block", marginBottom: 4 }}>
            Trick Name
          </span>
          <input
            type="text"
            value={trickName}
            onChange={(e) => setTrickName(e.target.value)}
            placeholder="e.g. Kickflip"
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #3f3f46",
              background: "#27272a",
              color: "#fff",
              fontSize: 14,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </label>

        {/* Caption */}
        <label style={{ display: "block", marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: "#a1a1aa", display: "block", marginBottom: 4 }}>
            Caption
          </span>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Say something about this clip..."
            rows={3}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #3f3f46",
              background: "#27272a",
              color: "#fff",
              fontSize: 14,
              outline: "none",
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
        </label>

        {/* Upload placeholder */}
        <div
          style={{
            border: "2px dashed #3f3f46",
            borderRadius: 12,
            padding: "20px 0",
            textAlign: "center",
            color: "#71717a",
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          🎥 Video upload coming soon
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          style={{
            width: "100%",
            padding: "10px 0",
            borderRadius: 10,
            border: "none",
            background: "#a855f7",
            color: "#fff",
            fontSize: 15,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Save Clip
        </button>
      </div>
    </div>
  );
}
