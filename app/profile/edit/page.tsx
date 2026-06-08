// ============================================================
// Edit Profile — /profile/edit
//
// Loads the signed-in user's profile row from the Supabase
// profiles table, lets them edit all editable fields, and
// saves changes via updateProfile() in profilesService.
//
// Editable fields:
//   avatar_url, banner_url, username, display_name,
//   bio, local_park, stance, is_public
//
// Read-only stat:
//   parks_visited_count  (auto-tracked, never set by the user)
//
// If the user is not signed in they are redirected to /profile.
// ============================================================

"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { useAuth } from "@/components/auth/AuthProvider";
import {
  getProfile,
  updateProfile,
  type Profile,
  type ProfileUpdate,
} from "@/lib/profilesService";

export default function EditProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const from = searchParams.get("from");

  const backHref = from === "settings" ? "/profile/settings" : "/profile";
  const backLabel = from === "settings" ? "Back to settings" : "Back to profile";

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

  // ---- UI state ----
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load the profile row when the auth user resolves
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      // Not signed in — redirect to login
      router.replace("/profile");
      return;
    }

    getProfile(user.id)
      .then((loaded) => {
        if (!loaded) {
          // Profile row doesn't exist yet — go back so ensureProfile runs
          router.replace("/profile");
          return;
        }

        // Populate form state with existing values
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

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;

    setError(null);
    setMessage(null);
    setSaving(true);

    // Build the update object — empty strings become null to keep the DB clean
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
      setError(
        saveError instanceof Error ? saveError.message : "Could not save profile."
      );
    } finally {
      setSaving(false);
    }
  }

  // ---- Loading state ----
  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-black px-5 py-8 text-white">
        <div className="mx-auto flex min-h-[70vh] max-w-lg items-center justify-center text-sm text-zinc-400">
          Loading profile...
        </div>
      </div>
    );
  }

  // Fallback — redirects are handled in useEffect
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

        {/* ---- Parks visited — read-only stat ---- */}
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

          {/* ---- Avatar preview ---- */}
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
            <p className="text-xs text-zinc-500">
              Enter an avatar URL below to update your photo
            </p>
          </div>

          {/* ---- Image URLs ---- */}
          <Field
            label="Avatar URL"
            value={avatarUrl}
            onChange={setAvatarUrl}
            placeholder="https://example.com/avatar.jpg"
          />
          <Field
            label="Banner URL"
            value={bannerUrl}
            onChange={setBannerUrl}
            placeholder="https://example.com/banner.jpg"
          />

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
              onChange={(e) =>
                setStance(e.target.value as "regular" | "goofy" | "")
              }
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
            {/* Toggle pill */}
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
            disabled={saving}
            className="w-full rounded-2xl bg-white py-3 text-sm font-semibold text-black transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// Reusable text / textarea field
// ============================================================
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
