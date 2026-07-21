"use client";

// ============================================================
// AddClipForm — lets a signed-in user add a clip link to their profile.
//
// Fields:
//   - External URL (required, must be https://)
//   - Platform (auto-detected from URL, manually overridable)
//   - Title (optional)
//   - Caption (optional)
//   - Cover image upload (optional, JPEG/PNG/WebP, max 5 MB)
//
// On success, calls onClipAdded so the parent can refresh the list.
// ============================================================

import { useRef, useState } from "react";
import { addClip, uploadClipCover } from "@/lib/clipsService";
import type { NewClipInput } from "@/types/social";
import type { ProfileClip } from "@/types/social";

type Platform = "tiktok" | "instagram" | "youtube" | "other";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function detectPlatform(url: string): Platform {
  if (url.includes("tiktok.com")) return "tiktok";
  if (url.includes("instagram.com")) return "instagram";
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  return "other";
}

type Props = {
  userId: string;
  spotId?: string;
  onClipAdded: (clip: ProfileClip) => void;
};

export default function AddClipForm({ userId, spotId, onClipAdded }: Props) {
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [url, setUrl] = useState("");
  const [platform, setPlatform] = useState<Platform>("other");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleUrlChange(value: string) {
    setUrl(value);
    if (value.startsWith("https://")) {
      setPlatform(detectPlatform(value));
    }
  }

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError("Only JPEG, PNG, or WebP images are allowed.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Cover image must be 5 MB or smaller.");
      return;
    }

    setError(null);
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!url.startsWith("https://")) {
      setError("URL must start with https://");
      return;
    }

    setSubmitting(true);
    try {
      const input: NewClipInput = {
        external_url: url.trim(),
        platform,
        title: title.trim() || undefined,
        caption: caption.trim() || undefined,
        spot_id: spotId || undefined,
      };

      // Insert the clip first to get the ID, then upload cover if provided
      const newClip = await addClip(input);

      if (coverFile) {
        const coverUrl = await uploadClipCover(userId, newClip.id, coverFile);
        // Update the clip row with the cover URL
        const { supabase } = await import("@/lib/supabase");
        await supabase
          .from("profile_clips")
          .update({ cover_image_url: coverUrl })
          .eq("id", newClip.id);
        newClip.cover_image_url = coverUrl;
      }

      onClipAdded(newClip);

      // Reset form
      setUrl("");
      setPlatform("other");
      setTitle("");
      setCaption("");
      setCoverFile(null);
      setCoverPreview(null);
      if (coverInputRef.current) coverInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add clip.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-2xl border border-line-soft bg-surface/60 p-4"
    >
      <p className="text-sm font-semibold text-ink">Add a Clip</p>

      {/* URL */}
      <label className="flex flex-col gap-1">
        <span className="text-xs text-faint">Clip URL (required)</span>
        <input
          type="url"
          value={url}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder="https://www.tiktok.com/..."
          required
          className="w-full rounded-2xl border border-line-soft bg-field px-4 py-2.5 text-sm text-ink outline-none placeholder:text-faint focus:border-accent/50"
        />
      </label>

      {/* Platform */}
      <label className="flex flex-col gap-1">
        <span className="text-xs text-faint">Platform</span>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value as Platform)}
          className="w-full rounded-2xl border border-line-soft bg-field px-4 py-2.5 text-sm text-ink outline-none focus:border-accent/50"
        >
          <option value="tiktok">TikTok</option>
          <option value="instagram">Instagram</option>
          <option value="youtube">YouTube</option>
          <option value="other">Other</option>
        </select>
      </label>

      {/* Title */}
      <label className="flex flex-col gap-1">
        <span className="text-xs text-faint">Title (optional)</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Switch heel down the LA High 7"
          className="w-full rounded-2xl border border-line-soft bg-field px-4 py-2.5 text-sm text-ink outline-none placeholder:text-faint focus:border-accent/50"
        />
      </label>

      {/* Caption */}
      <label className="flex flex-col gap-1">
        <span className="text-xs text-faint">Caption (optional)</span>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={2}
          placeholder="A note about the clip..."
          className="w-full resize-none rounded-2xl border border-line-soft bg-field px-4 py-2.5 text-sm text-ink outline-none placeholder:text-faint focus:border-accent/50"
        />
      </label>

      {/* Cover image */}
      <div className="flex flex-col gap-2">
        <span className="text-xs text-faint">Cover Image (optional)</span>
        {coverPreview && (
          <img
            src={coverPreview}
            alt="Cover preview"
            className="h-32 w-full rounded-xl object-cover"
          />
        )}
        <input
          ref={coverInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleCoverChange}
        />
        <button
          type="button"
          onClick={() => coverInputRef.current?.click()}
          className="rounded-2xl border border-line-soft py-2 text-xs text-muted transition-colors hover:border-muted hover:text-ink"
        >
          {coverFile ? "Change Cover" : "Upload Cover"}
        </button>
        <p className="text-xs text-faint">JPEG, PNG, or WebP · max 5 MB</p>
      </div>

      {error && (
        <p className="rounded-xl border border-danger/30 bg-danger/15 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-2xl bg-accent py-2.5 text-sm font-semibold text-on-accent transition-transform hover:bg-accent-press active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Adding..." : "Add Clip"}
      </button>
    </form>
  );
}
