// ============================================================
// Edit Profile — /profile/edit
//
// Lets users edit all editable profile fields.
// Avatar and banner are uploaded to Supabase Storage (avatars bucket).
// Avatar path: {userId}/avatar.{ext}
// Banner path: {userId}/banner.{ext}
// ============================================================

"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { useAuth } from "@/components/auth/AuthProvider";
import {
  getProfile,
  updateProfile,
  type Profile,
  type ProfileUpdate,
} from "@/lib/profilesService";
import { supabase } from "@/lib/supabase";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

async function uploadProfileImage(
  userId: string,
  file: File,
  slot: "avatar" | "banner"
): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${slot}.${ext}`;

  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}

export default function EditProfilePage() {
  return (
    <Suspense>
      <EditProfileContent />
    </Suspense>
  );
}

function EditProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const from = searchParams.get("from");

  const backHref = from === "settings" ? "/profile/settings" : "/profile";
  const backLabel = from === "settings" ? "Back to settings" : "Back to profile";

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // ---- Profile loading state ----
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // ---- Editable form fields ----
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [stance, setStance] = useState<"regular" | "goofy" | "">("");
  const [localPark, setLocalPark] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  // ---- Upload state ----
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  // ---- UI state ----
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/profile"); return; }

    getProfile(user.id)
      .then((loaded) => {
        if (!loaded) { router.replace("/profile"); return; }
        setProfile(loaded);
        setUsername(loaded.username ?? "");
        setDisplayName(loaded.display_name ?? "");
        setBio(loaded.bio ?? "");
        setAvatarUrl(loaded.avatar_url ?? "");
        setBannerUrl(loaded.banner_url ?? "");
        setStance(loaded.stance ?? "");
        setLocalPark(loaded.local_park ?? "");
        setIsPublic(loaded.is_public);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not load profile.");
      })
      .finally(() => setProfileLoading(false));
  }, [authLoading, user, router]);

  function validateImageFile(file: File): string | null {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return "Only JPEG, PNG, or WebP images are allowed.";
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return "Image must be 5 MB or smaller.";
    }
    return null;
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const validationError = validateImageFile(file);
    if (validationError) { setError(validationError); return; }

    setError(null);
    setUploadingAvatar(true);
    try {
      const url = await uploadProfileImage(user.id, file, "avatar");
      setAvatarUrl(url);
      // Persist immediately so the new avatar isn't lost if the user navigates away
      await updateProfile(user.id, { avatar_url: url });
      setMessage("Avatar updated!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Avatar upload failed.");
    } finally {
      setUploadingAvatar(false);
      // Reset file input so the same file can be re-selected if needed
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  async function handleBannerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const validationError = validateImageFile(file);
    if (validationError) { setError(validationError); return; }

    setError(null);
    setUploadingBanner(true);
    try {
      const url = await uploadProfileImage(user.id, file, "banner");
      setBannerUrl(url);
      await updateProfile(user.id, { banner_url: url });
      setMessage("Banner updated!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Banner upload failed.");
    } finally {
      setUploadingBanner(false);
      if (bannerInputRef.current) bannerInputRef.current.value = "";
    }
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;

    setError(null);
    setMessage(null);
    setSaving(true);

    const updates: ProfileUpdate = {
      username: username.trim() || null,
      display_name: displayName.trim() || null,
      bio: bio.trim() || null,
      avatar_url: avatarUrl.trim() || null,
      banner_url: bannerUrl.trim() || null,
      stance: (stance as "regular" | "goofy") || null,
      local_park: localPark.trim() || null,
      is_public: isPublic,
    };

    try {
      const updated = await updateProfile(user.id, updates);
      setProfile(updated);
      setMessage("Profile saved!");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-black px-5 py-8 text-white">
        <div className="mx-auto flex min-h-[70vh] max-w-lg items-center justify-center text-sm text-zinc-400">
          Loading profile...
        </div>
      </div>
    );
  }

  if (!user || !profile) return null;

  return (
    <div className="min-h-screen bg-black px-5 py-8 text-white">
      <div className="mx-auto max-w-lg">
        <Link
          href={backHref}
          className="mb-6 inline-flex items-center gap-1 text-sm text-zinc-400 transition-colors hover:text-white"
        >
          ← {backLabel}
        </Link>

        <h1 className="mb-6 text-2xl font-bold">Edit Profile</h1>

        {profile.parks_visited_count > 0 && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-white/10 bg-zinc-900/70 px-4 py-3">
            <span className="text-lg" aria-hidden="true">📍</span>
            <div>
              <p className="text-xs text-zinc-500">Parks Visited</p>
              <p className="text-sm font-semibold">{profile.parks_visited_count}</p>
            </div>
            <p className="ml-auto text-xs text-zinc-600">Auto-tracked</p>
          </div>
        )}

        <form onSubmit={handleSave} className="flex flex-col gap-5">

          {/* ---- Banner upload ---- */}
          <div className="flex flex-col gap-2">
            <span className="text-xs text-zinc-500">Banner</span>
            {bannerUrl ? (
              <img
                src={bannerUrl}
                alt="Banner preview"
                className="h-24 w-full rounded-2xl border border-white/10 object-cover"
              />
            ) : (
              <div className="h-24 w-full rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-800 to-zinc-900" />
            )}
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleBannerChange}
            />
            <button
              type="button"
              disabled={uploadingBanner}
              onClick={() => bannerInputRef.current?.click()}
              className="rounded-2xl border border-white/10 bg-zinc-900 py-2 text-xs text-zinc-400 transition-colors hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploadingBanner ? "Uploading..." : "Upload Banner"}
            </button>
          </div>

          {/* ---- Avatar upload ---- */}
          <div className="flex flex-col items-center gap-3">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar preview"
                className="h-20 w-20 rounded-full border border-white/10 object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-zinc-800 text-3xl font-bold text-zinc-400">
                {(displayName || username)[0]?.toUpperCase() ?? "G"}
              </div>
            )}
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <button
              type="button"
              disabled={uploadingAvatar}
              onClick={() => avatarInputRef.current?.click()}
              className="rounded-2xl border border-white/10 bg-zinc-900 px-4 py-2 text-xs text-zinc-400 transition-colors hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploadingAvatar ? "Uploading..." : "Upload Avatar"}
            </button>
            <p className="text-xs text-zinc-600">JPEG, PNG, or WebP · max 5 MB</p>
          </div>

          {/* ---- Identity ---- */}
          <Field
            label="Username"
            value={username}
            onChange={setUsername}
            prefix="@"
            placeholder="your skate name"
          />
          <Field
            label="Display Name"
            value={displayName}
            onChange={setDisplayName}
            placeholder="e.g. Alex Hawk"
          />

          {/* ---- About ---- */}
          <Field
            label="Bio"
            value={bio}
            onChange={setBio}
            multiline
            placeholder="A few words about your skating..."
          />
          <Field
            label="Local Park"
            value={localPark}
            onChange={setLocalPark}
            placeholder="e.g. Venice Beach Skatepark"
          />

          {/* ---- Stance select ---- */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Stance</span>
            <select
              value={stance}
              onChange={(e) => setStance(e.target.value as "regular" | "goofy" | "")}
              className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-zinc-500"
            >
              <option value="">Not set</option>
              <option value="regular">Regular</option>
              <option value="goofy">Goofy</option>
            </select>
          </label>

          {/* ---- Public profile toggle ---- */}
          <div
            role="group"
            className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/10 bg-zinc-900/70 px-4 py-3"
            onClick={() => setIsPublic((prev) => !prev)}
          >
            <div>
              <p className="text-sm font-medium">Public Profile</p>
              <p className="text-xs text-zinc-500">
                When off, your profile is hidden from other users.
              </p>
            </div>
            <div
              role="switch"
              aria-checked={isPublic}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                isPublic ? "bg-green-500" : "bg-zinc-700"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  isPublic ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </div>
          </div>

          {/* ---- Feedback ---- */}
          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}
          {message && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={saving || uploadingAvatar || uploadingBanner}
            className="w-full rounded-2xl bg-white py-3 text-sm font-semibold text-black transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  prefix,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  prefix?: string;
  multiline?: boolean;
}) {
  const inputClasses =
    "w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-zinc-500";

  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-zinc-500">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className={`${inputClasses} resize-vertical`}
        />
      ) : (
        <div className="relative">
          {prefix && (
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
              {prefix}
            </span>
          )}
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`${inputClasses} ${prefix ? "pl-8" : ""}`}
          />
        </div>
      )}
    </label>
  );
}
