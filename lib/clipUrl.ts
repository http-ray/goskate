// ============================================================
// clipUrl.ts
//
// Pure helpers for working with external clip URLs — platform
// detection and embed-id extraction. Kept framework-free so they
// can be unit-tested and shared between ClipCard and AddClipForm.
// ============================================================

export type Platform = "tiktok" | "instagram" | "youtube" | "other";

// Best-effort platform detection from a clip URL.
export function detectPlatform(url: string): Platform {
  if (url.includes("tiktok.com")) return "tiktok";
  if (url.includes("instagram.com")) return "instagram";
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  return "other";
}

// Extract the numeric TikTok video id from a URL, or null.
export function extractTikTokVideoId(url: string): string | null {
  const match = url.match(/\/video\/(\d+)/);
  return match ? match[1] : null;
}

// Extract the Instagram post/reel/tv shortcode from a URL, or null.
export function extractInstagramShortcode(url: string): string | null {
  const match = url.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}
