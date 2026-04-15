// ============================================================
// Mock user data — the "logged in" user for the profile hub.
//
// In a real app this would come from auth + database.
// For now it's a single hardcoded object so every profile
// page has something to display.
// ============================================================

// ---- Types ----

export type UserProfile = {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  /** Name of the user's home skatepark */
  homePark: string;
  stance: "regular" | "goofy";
  favoriteTrick: string;
  /** Total clips the user has posted */
  clipsCount: number;
  /** Total check-ins the user has done */
  checkInsCount: number;
  /** Number of friends */
  friendsCount: number;
};

export type Friend = {
  id: string;
  username: string;
  displayName: string;
  /** Short status line shown under the username */
  status: string;
};

// ---- Demo user ----

export const DEMO_USER: UserProfile = {
  id: "me",
  username: "kickflip_kyle",
  displayName: "Kyle Martinez",
  bio: "LA native. Street skating and park laps. Always filming. 🎥🛹",
  homePark: "Venice Beach Skatepark",
  stance: "goofy",
  favoriteTrick: "Kickflip",
  clipsCount: 34,
  checkInsCount: 87,
  friendsCount: 12,
};

// ---- Demo friends list ----

export const DEMO_FRIENDS: Friend[] = [
  { id: "f1", username: "sk8_jess", displayName: "Jess Rivera", status: "Skating at Venice Beach" },
  { id: "f2", username: "tre_flip_tony", displayName: "Tony Nguyen", status: "Last seen 2h ago" },
  { id: "f3", username: "nollie_nat", displayName: "Natalie Kim", status: "Checked in at The Berrics" },
  { id: "f4", username: "rail_ronnie", displayName: "Ronnie Diaz", status: "Last seen 1d ago" },
  { id: "f5", username: "echo_eddie", displayName: "Eddie Park", status: "Filming at Echo Park Rail" },
  { id: "f6", username: "pro_parker", displayName: "Parker James", status: "Online" },
  { id: "f7", username: "noseslide_nia", displayName: "Nia Thompson", status: "Last seen 5h ago" },
  { id: "f8", username: "ollie_owen", displayName: "Owen Chen", status: "At The Berrics" },
  { id: "f9", username: "heelflip_hana", displayName: "Hana Sato", status: "Last seen 3d ago" },
  { id: "f10", username: "diy_dave", displayName: "Dave Wilson", status: "Building a new ramp" },
  { id: "f11", username: "manual_maria", displayName: "Maria Lopez", status: "Last seen 12h ago" },
  { id: "f12", username: "fs_flip_fiona", displayName: "Fiona O'Brien", status: "Online" },
];
