// ============================================================
// Edit Profile — /profile/edit
//
// A simple form for updating the user's profile info.
// All state is local (useState) — nothing is persisted yet.
// Pre-filled with the demo user's current values.
//
// Fields:
//   - display name, username, bio, home park, stance,
//     favorite trick, profile image placeholder
// ============================================================

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DEMO_USER } from "@/data/demoUser";

export default function EditProfilePage() {
  const router = useRouter();

  // ---- Form state — pre-filled from mock data ----
  const [displayName, setDisplayName] = useState(DEMO_USER.displayName);
  const [username, setUsername] = useState(DEMO_USER.username);
  const [bio, setBio] = useState(DEMO_USER.bio);
  const [homePark, setHomePark] = useState(DEMO_USER.homePark);
  const [stance, setStance] = useState(DEMO_USER.stance);
  const [favoriteTrick, setFavoriteTrick] = useState(DEMO_USER.favoriteTrick);

  const handleSave = () => {
    // Placeholder — just show a confirmation for now
    alert("Profile updated (placeholder)!");
    router.push("/profile");
  };

  return (
    <div className="min-h-screen bg-black text-white px-5 py-8 font-sans max-w-lg mx-auto">
      {/* ---- Back ---- */}
      <Link
        href="/profile"
        className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white mb-6"
      >
        ← Back to profile
      </Link>

      <h1 className="text-2xl font-bold mb-6">Edit Profile</h1>

      {/* ============================================
          AVATAR PLACEHOLDER
          ============================================ */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-24 h-24 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center text-4xl font-bold text-zinc-400 mb-3">
          {displayName[0] || "?"}
        </div>
        <button
          type="button"
          onClick={() => alert("Photo upload coming soon!")}
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          Change Photo
        </button>
      </div>

      {/* ============================================
          FORM FIELDS
          ============================================ */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
        className="flex flex-col gap-5"
      >
        <Field label="Display Name" value={displayName} onChange={setDisplayName} />
        <Field label="Username" value={username} onChange={setUsername} prefix="@" />
        <Field label="Bio" value={bio} onChange={setBio} multiline />
        <Field label="Home Park" value={homePark} onChange={setHomePark} placeholder="e.g. Venice Beach Skatepark" />

        {/* Stance — select */}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Stance</span>
          <select
            value={stance}
            onChange={(e) => setStance(e.target.value as "regular" | "goofy")}
            className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600"
          >
            <option value="regular">Regular</option>
            <option value="goofy">Goofy</option>
          </select>
        </label>

        <Field label="Favorite Trick" value={favoriteTrick} onChange={setFavoriteTrick} placeholder="e.g. Kickflip" />

        {/* ---- Save button ---- */}
        <button
          type="submit"
          className="w-full py-3 rounded-xl bg-green-500 text-white font-bold text-sm hover:bg-green-600 active:scale-[0.98] transition-all mt-2"
        >
          Save Changes
        </button>
      </form>
    </div>
  );
}

// ============================================================
// Reusable text field
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
    "w-full rounded-lg bg-zinc-900 border border-zinc-800 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600";

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
