import { describe, it, expect } from "vitest";
import {
  detectPlatform,
  extractTikTokVideoId,
  extractInstagramShortcode,
} from "@/lib/clipUrl";

describe("detectPlatform", () => {
  it("detects TikTok", () => {
    expect(detectPlatform("https://www.tiktok.com/@user/video/123")).toBe(
      "tiktok"
    );
  });

  it("detects Instagram", () => {
    expect(detectPlatform("https://www.instagram.com/reel/AbC/")).toBe(
      "instagram"
    );
  });

  it("detects YouTube (both hosts)", () => {
    expect(detectPlatform("https://www.youtube.com/watch?v=x")).toBe("youtube");
    expect(detectPlatform("https://youtu.be/x")).toBe("youtube");
  });

  it("falls back to 'other'", () => {
    expect(detectPlatform("https://example.com/clip")).toBe("other");
  });
});

describe("extractTikTokVideoId", () => {
  it("extracts the numeric id", () => {
    expect(
      extractTikTokVideoId("https://www.tiktok.com/@user/video/7412345678901234567")
    ).toBe("7412345678901234567");
  });

  it("returns null when there is no video id", () => {
    expect(extractTikTokVideoId("https://www.tiktok.com/@user")).toBeNull();
  });
});

describe("extractInstagramShortcode", () => {
  it("extracts the shortcode from p / reel / tv URLs", () => {
    expect(
      extractInstagramShortcode("https://www.instagram.com/p/CxYz_123/")
    ).toBe("CxYz_123");
    expect(
      extractInstagramShortcode("https://instagram.com/reel/AbC-9/")
    ).toBe("AbC-9");
  });

  it("returns null for non-post URLs", () => {
    expect(
      extractInstagramShortcode("https://www.instagram.com/someuser/")
    ).toBeNull();
  });
});
