"use client";

import Link from "next/link";
import { Spot } from "@/types/spot";
import { useAuth } from "@/components/auth/AuthProvider";
import AddClipForm from "./AddClipForm";

interface AddClipModalProps {
  spot: Spot;
  onClose: () => void;
}

export default function AddClipModal({ spot, onClose }: AddClipModalProps) {
  const { user } = useAuth();

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "90%",
          maxWidth: 420,
          maxHeight: "90vh",
          overflowY: "auto",
          background: "#09090b",
          borderRadius: 16,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px 0",
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff" }}>
              Add Clip
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#71717a" }}>
              at {spot.name}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "none",
              border: "none",
              color: "#71717a",
              fontSize: 20,
              cursor: "pointer",
              lineHeight: 1,
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: "12px 20px 20px" }}>
          {user ? (
            <AddClipForm
              userId={user.id}
              spotId={spot.id}
              onClipAdded={() => onClose()}
            />
          ) : (
            <div style={{ textAlign: "center", padding: "28px 0 8px" }}>
              <p
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#fff",
                  margin: "0 0 6px",
                }}
              >
                Sign in to add clips
              </p>
              <p
                style={{
                  fontSize: 13,
                  color: "#71717a",
                  margin: "0 0 20px",
                }}
              >
                You need to be signed in to share a clip at this spot.
              </p>
              <Link
                href="/profile"
                onClick={onClose}
                style={{
                  display: "inline-block",
                  padding: "10px 24px",
                  background: "#fff",
                  color: "#000",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
