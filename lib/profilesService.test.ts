import { describe, it, expect, vi, beforeEach } from "vitest";
import type { User } from "@supabase/supabase-js";

const state = {
  // Queue of results for successive getProfile() calls — lets a test
  // simulate "not found, then found after a concurrent insert lands".
  selectResults: [] as Array<Record<string, unknown> | null>,
  insertError: null as { code: string; message: string } | null,
};

function makeSingleResult(data: unknown, error: unknown) {
  return Promise.resolve({ data, error });
}

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          single: () => {
            const next = state.selectResults.shift() ?? null;
            return makeSingleResult(
              next,
              next ? null : { code: "PGRST116", message: "no rows" }
            );
          },
        }),
      }),
      insert: () => ({
        select: () => ({
          single: () =>
            state.insertError
              ? makeSingleResult(null, state.insertError)
              : makeSingleResult({ id: "user-1", username: "skater" }, null),
        }),
      }),
    })),
  },
}));

import { ensureProfile } from "@/lib/profilesService";

const fakeUser = { id: "user-1", email: "skater@example.com", user_metadata: {} } as User;

describe("ensureProfile", () => {
  beforeEach(() => {
    state.selectResults = [];
    state.insertError = null;
  });

  it("creates a new profile when none exists", async () => {
    state.selectResults = [null]; // initial getProfile(): not found
    const profile = await ensureProfile(fakeUser);
    expect(profile.id).toBe("user-1");
  });

  it("recovers instead of throwing when a concurrent call already created the row (23505 race)", async () => {
    // 1st getProfile() (before insert): not found — proceeds to insert.
    // Insert fails as a duplicate because another concurrent ensureProfile()
    // call already created the row first.
    // 2nd getProfile() (recovery after the 23505): finds it.
    state.selectResults = [null, { id: "user-1", username: "skater" }];
    state.insertError = { code: "23505", message: "duplicate key value violates unique constraint" };

    const profile = await ensureProfile(fakeUser);
    expect(profile.id).toBe("user-1");
  });

  it("still throws on a real (non-race) insert error", async () => {
    state.selectResults = [null];
    state.insertError = { code: "42501", message: "permission denied" };

    await expect(ensureProfile(fakeUser)).rejects.toBeTruthy();
  });
});
