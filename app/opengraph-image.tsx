// ============================================================
// Open Graph image — the preview card shown when a GoSkate link
// is shared to social / messaging. Generated at request time by
// next/og (no binary asset to maintain).
// ============================================================

import { ImageResponse } from "next/og";

export const alt = "GoSkate — Find & Share Skate Spots";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#0e0f13",
          color: "#f3f5f8",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 28,
            letterSpacing: 8,
            textTransform: "uppercase",
            color: "#f4e7d0",
            marginBottom: 24,
          }}
        >
          The map built for skaters
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 92,
            fontWeight: 800,
            lineHeight: 1.05,
          }}
        >
          GoSkate
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 40,
            color: "#a2a9b8",
            marginTop: 20,
          }}
        >
          Find your next skate spot.
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 48,
            height: 8,
            width: 160,
            background: "#f4e7d0",
            borderRadius: 999,
          }}
        />
      </div>
    ),
    { ...size }
  );
}
