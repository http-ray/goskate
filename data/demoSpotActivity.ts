// ============================================================
// Mock activity data — people checked in and public clips.
//
// These are separate from the Spot type on purpose. In a real
// app they'd come from a database; for now they're hardcoded
// keyed by spot ID so the View Spot page can look them up.
// ============================================================

// ---- Types ----

export type PersonHere = {
  username: string;
  /** Is this person a "friend" of the viewer?  (mock flag) */
  isFriend: boolean;
};

export type PublicClip = {
  id: string;
  username: string;
  trickName: string;
  caption: string;
  /** Seconds ago the clip was posted (used for "time ago" display) */
  postedSecondsAgo: number;
};

// ---- Data keyed by spot ID ----

export const PEOPLE_BY_SPOT: Record<string, PersonHere[]> = {
  "official-1": [
    { username: "sk8_jess", isFriend: true },
    { username: "boardlord99", isFriend: false },
    { username: "venice_vibe", isFriend: false },
    { username: "nollie_nat", isFriend: true },
    { username: "grindr_mike", isFriend: false },
    { username: "kickflip_kim", isFriend: false },
    { username: "rail_ronnie", isFriend: true },
    { username: "drop_in_dan", isFriend: false },
  ],
  "official-2": [
    { username: "tre_flip_tony", isFriend: true },
    { username: "stoner_sam", isFriend: false },
    { username: "heelflip_hana", isFriend: false },
  ],
  "official-3": [],
  "official-4": [
    { username: "berrics_fan01", isFriend: false },
    { username: "pro_parker", isFriend: true },
    { username: "switch_stance", isFriend: false },
    { username: "nollie_nat", isFriend: true },
    { username: "flatground_fay", isFriend: false },
    { username: "crook_grind_cal", isFriend: false },
    { username: "noseslide_nia", isFriend: true },
    { username: "pop_shove_pete", isFriend: false },
    { username: "manual_maria", isFriend: false },
    { username: "gap_master_gus", isFriend: false },
    { username: "ollie_owen", isFriend: true },
    { username: "fs_flip_fiona", isFriend: false },
  ],
  "official-5": [
    { username: "ledge_lord", isFriend: false },
  ],
  "user-1": [],
  "user-2": [
    { username: "echo_eddie", isFriend: true },
  ],
  "user-3": [
    { username: "diy_dave", isFriend: false },
    { username: "sk8_jess", isFriend: true },
  ],
};

export const CLIPS_BY_SPOT: Record<string, PublicClip[]> = {
  "official-1": [
    { id: "c1", username: "sk8_jess", trickName: "Kickflip", caption: "Clean landing first try 🔥", postedSecondsAgo: 300 },
    { id: "c2", username: "boardlord99", trickName: "Frontside 180", caption: "Sunset session", postedSecondsAgo: 1800 },
    { id: "c3", username: "venice_vibe", trickName: "Drop In", caption: "Finally committed to the big bowl", postedSecondsAgo: 7200 },
    { id: "c4", username: "nollie_nat", trickName: "Nollie Heelflip", caption: "🤙", postedSecondsAgo: 14400 },
  ],
  "official-2": [
    { id: "c5", username: "tre_flip_tony", trickName: "Tre Flip", caption: "Stoner plaza never disappoints", postedSecondsAgo: 600 },
    { id: "c6", username: "heelflip_hana", trickName: "Heelflip", caption: "First heelflip on video!", postedSecondsAgo: 86400 },
  ],
  "official-3": [
    { id: "c7", username: "pro_parker", trickName: "Kickflip Backside Tailslide", caption: "Hollywood High 16 bucket list ✓", postedSecondsAgo: 3600 },
    { id: "c8", username: "ledge_lord", trickName: "50-50", caption: "Warm-up grind", postedSecondsAgo: 43200 },
    { id: "c9", username: "switch_stance", trickName: "Switch Ollie", caption: "Down the 16. Legs shaking lol", postedSecondsAgo: 172800 },
  ],
  "official-4": [
    { id: "c10", username: "berrics_fan01", trickName: "Varial Kickflip", caption: "Berrics floor is so smooth", postedSecondsAgo: 900 },
    { id: "c11", username: "pro_parker", trickName: "Backside Noseblunt", caption: "Got it after 47 tries", postedSecondsAgo: 5400 },
    { id: "c12", username: "nollie_nat", trickName: "Nollie Tre Flip", caption: "Best trick of the day", postedSecondsAgo: 28800 },
    { id: "c13", username: "fs_flip_fiona", trickName: "Frontside Flip", caption: "First one ever 😭", postedSecondsAgo: 86400 },
    { id: "c14", username: "manual_maria", trickName: "Manual", caption: "Full length of the pad!", postedSecondsAgo: 259200 },
  ],
  "official-5": [
    { id: "c15", username: "ledge_lord", trickName: "Crooked Grind", caption: "Courthouse ledges hit different", postedSecondsAgo: 7200 },
  ],
  "user-1": [
    { id: "c16", username: "echo_eddie", trickName: "Ollie", caption: "Gap is sketchier than it looks", postedSecondsAgo: 172800 },
  ],
  "user-2": [
    { id: "c17", username: "echo_eddie", trickName: "Boardslide", caption: "Rail is perfect length", postedSecondsAgo: 43200 },
    { id: "c18", username: "sk8_jess", trickName: "Frontside Noseslide", caption: "Slid the whole thing!", postedSecondsAgo: 604800 },
  ],
  "user-3": [
    { id: "c19", username: "diy_dave", trickName: "Rock to Fakie", caption: "DIY quarter pipe 🛠️", postedSecondsAgo: 3600 },
    { id: "c20", username: "sk8_jess", trickName: "Backside Air", caption: "Culver City DIY is underrated", postedSecondsAgo: 86400 },
  ],
};

// ---- Helpers ----

/** Get people at a spot, split into friends and others. */
export function getPeopleAtSpot(spotId: string) {
  const all = PEOPLE_BY_SPOT[spotId] ?? [];
  return {
    friends: all.filter((p) => p.isFriend),
    others: all.filter((p) => !p.isFriend),
  };
}

/** Get public clips for a spot, sorted newest first. */
export function getClipsForSpot(spotId: string): PublicClip[] {
  return [...(CLIPS_BY_SPOT[spotId] ?? [])].sort(
    (a, b) => a.postedSecondsAgo - b.postedSecondsAgo
  );
}

/** Turn a seconds-ago value into a human-readable "time ago" string. */
export function timeAgo(seconds: number): string {
  if (seconds < 60) return "just now";
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
