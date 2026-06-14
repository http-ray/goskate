"use client";

import { useState } from "react";
import type { ProfileClip } from "@/types/social";

const PLATFORM_COLORS: Record<string, string> = {
  tiktok: "bg-black text-white border-white/10",
  instagram: "bg-gradient-to-br from-purple-600 to-pink-500 text-white border-transparent",
  youtube: "bg-red-600 text-white border-transparent",
  other: "bg-zinc-800 text-zinc-300 border-white/10",
};

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  other: "Clip",
};

function extractTikTokVideoId(url: string): string | null {
  const match = url.match(/\/video\/(\d+)/);
  return match ? match[1] : null;
}

function extractInstagramShortcode(url: string): string | null {
  const match = url.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

// ---- MediaSection -------------------------------------------------------
// Renders the top visual area of the card. TikTok and Instagram use iframes.
// All other platforms (and failed/invalid embeds) fall back to cover image
// or a platform-colored placeholder with an optional unavailable message.
// -------------------------------------------------------------------------
function MediaSection({ clip }: { clip: ProfileClip }) {
  const [embedError, setEmbedError] = useState(false);

  const platformColor = PLATFORM_COLORS[clip.platform] ?? PLATFORM_COLORS.other;
  const platformLabel = PLATFORM_LABELS[clip.platform] ?? "Clip";

  const tiktokVideoId =
    clip.platform === "tiktok" ? extractTikTokVideoId(clip.external_url) : null;

  const instagramShortcode =
    clip.platform === "instagram"
      ? extractInstagramShortcode(clip.external_url)
      : null;

  // TikTok embed
  if (tiktokVideoId && !embedError) {
    return (
      <iframe
        src={`https://www.tiktok.com/embed/v2/${tiktokVideoId}`}
        className="h-[420px] w-full border-0 bg-black"
        allow="encrypted-media"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation-by-user-activation"
        onError={() => setEmbedError(true)}
        title={clip.title ?? "TikTok clip"}
      />
    );
  }

  // Instagram embed
  if (instagramShortcode && !embedError) {
    return (
      <iframe
        src={`https://www.instagram.com/p/${instagramShortcode}/embed/`}
        className="h-[420px] w-full border-0"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation-by-user-activation"
        onError={() => setEmbedError(true)}
        title={clip.title ?? "Instagram post"}
      />
    );
  }

  // Show unavailable message when embed was expected but couldn't be built or failed
  const showUnavailableMsg =
    embedError ||
    (clip.platform === "tiktok" && !tiktokVideoId) ||
    (clip.platform === "instagram" && !instagramShortcode);

  // Cover image fallback (click-through to original)
  return (
    <a href={clip.external_url} target="_blank" rel="noopener noreferrer" className="block">
      {clip.cover_image_url ? (
        <img
          src={clip.cover_image_url}
          alt={clip.title ?? "Clip cover"}
          className="h-44 w-full object-cover transition-opacity hover:opacity-90"
        />
      ) : (
        <div
          className={`flex h-44 w-full flex-col items-center justify-center gap-2 border-b border-white/5 px-4 text-center ${platformColor}`}
        >
          <span className="text-sm font-semibold">{platformLabel}</span>
          {showUnavailableMsg && (
            <span className="text-xs font-normal opacity-75">
              Clip unavailable. The original post may have been deleted, made private, or
              restricted.
            </span>
          )}
        </div>
      )}
    </a>
  );
}

// ---- ClipCard -----------------------------------------------------------

type Props = {
  clip: ProfileClip;
  onDelete?: (clip: ProfileClip) => void;
};

export default function ClipCard({ clip, onDelete }: Props) {
  const platformLabel = PLATFORM_LABELS[clip.platform] ?? "Clip";
  const platformColor = PLATFORM_COLORS[clip.platform] ?? PLATFORM_COLORS.other;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900">
      <MediaSection clip={clip} />

      {/* Info row */}
      <div className="p-3">
        <div className="mb-1 flex items-start justify-between gap-2">
          <p className="flex-1 truncate text-sm font-medium text-white">
            {clip.title ?? "Untitled clip"}
          </p>
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${platformColor}`}
          >
            {platformLabel}
          </span>
        </div>

        {clip.caption && (
          <p className="mb-2 line-clamp-2 text-xs text-zinc-400">{clip.caption}</p>
        )}

        <div className="flex items-center justify-between gap-2">
          <a
            href={clip.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-400 underline-offset-2 hover:text-white hover:underline"
          >
            Open original ↗
          </a>

          {onDelete && (
            <button
              onClick={() => onDelete(clip)}
              className="text-xs text-zinc-600 transition-colors hover:text-red-400"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
