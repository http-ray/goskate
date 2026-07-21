"use client";

// ============================================================
// Following/Followers — /profile/friends
//
// Shows two tabs: Following (people you follow) and Followers
// (people who follow you). Requires authentication.
// ============================================================

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import { getFollowing, getFollowers } from "@/lib/followsService";
import ProfileCard from "@/components/ui/ProfileCard";
import type { Profile } from "@/lib/profilesService";

type Tab = "following" | "followers";

export default function FriendsPage() {
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<Tab>("following");
  const [following, setFollowing] = useState<Profile[]>([]);
  const [followers, setFollowers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    if (loaded) return;

    setLoading(true);
    Promise.all([getFollowing(user.id), getFollowers(user.id)])
      .then(([fwing, fwers]) => {
        setFollowing(fwing);
        setFollowers(fwers);
        setLoaded(true);
      })
      .catch(() => {
        toast.error("Couldn't load your connections. Please try again.");
      })
      .finally(() => setLoading(false));
  }, [authLoading, user, loaded, toast]);

  function handleFollowChange(profileId: string, nowFollowing: boolean) {
    if (!nowFollowing) {
      // Unfollowed someone — remove them from the Following list
      setFollowing((prev) => prev.filter((p) => p.id !== profileId));
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base text-sm text-muted">
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-base text-ink">
        <p className="text-sm text-muted">Sign in to see who you follow.</p>
        <Link href="/profile" className="text-sm underline-offset-2 hover:underline">
          Sign in
        </Link>
      </div>
    );
  }

  const list = activeTab === "following" ? following : followers;

  return (
    <div className="min-h-screen bg-base px-5 py-8 text-ink">
      <div className="mx-auto max-w-lg">
        <Link
          href="/profile"
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
        >
          ← Back to profile
        </Link>

        <h1 className="mb-5 text-2xl font-bold">Connections</h1>

        {/* Tab switcher */}
        <div className="mb-5 flex rounded-2xl border border-line-soft bg-surface p-1">
          {(["following", "followers"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 rounded-xl py-2 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? "bg-accent text-on-accent"
                  : "text-muted hover:text-ink"
              }`}
            >
              {tab === "following"
                ? `Following${following.length ? ` · ${following.length}` : ""}`
                : `Followers${followers.length ? ` · ${followers.length}` : ""}`}
            </button>
          ))}
        </div>

        {/* Also find skaters link */}
        <div className="mb-4 flex justify-end">
          <Link
            href="/users/search"
            className="text-xs text-faint underline-offset-2 hover:text-ink hover:underline"
          >
            Find skaters →
          </Link>
        </div>

        {/* List */}
        {loading ? (
          <p className="text-center text-sm text-faint">Loading...</p>
        ) : list.length === 0 ? (
          <div className="rounded-2xl border border-line-soft bg-surface/60 px-6 py-12 text-center">
            <p className="text-sm text-muted">
              {activeTab === "following"
                ? "You aren't following anyone yet."
                : "No followers yet."}
            </p>
            {activeTab === "following" && (
              <Link
                href="/users/search"
                className="mt-3 inline-block text-xs text-faint underline-offset-2 hover:text-ink hover:underline"
              >
                Find skaters to follow →
              </Link>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {list.map((profile) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                isFollowing={activeTab === "following"}
                showFollowButton={activeTab === "following"}
                onFollowChange={handleFollowChange}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
