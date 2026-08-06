import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SpotSubmission } from "@/types/spot";

const insertMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: (payload: Record<string, unknown>) => {
        insertMock(payload);
        return {
          select: () => ({
            single: () =>
              Promise.resolve({ data: { id: "test-spot-id" }, error: null }),
          }),
        };
      },
    })),
  },
}));

import { submitSpot } from "@/lib/spotsService";

describe("submitSpot", () => {
  beforeEach(() => {
    insertMock.mockClear();
  });

  const submission: SpotSubmission = {
    display_name: "Test Spot",
    type: "street",
    latitude: 34.05,
    longitude: -118.25,
  };

  it("sets possible_duplicate = true when nearby spots were found before submission", async () => {
    await submitSpot("user-1", submission, true);

    expect(insertMock).toHaveBeenCalledTimes(1);
    const payload = insertMock.mock.calls[0][0];
    expect(payload.possible_duplicate).toBe(true);
  });

  it("sets possible_duplicate = false when no nearby spots were found", async () => {
    await submitSpot("user-1", submission, false);

    const payload = insertMock.mock.calls[0][0];
    expect(payload.possible_duplicate).toBe(false);
  });

  it("defaults possible_duplicate to false when the caller omits the flag", async () => {
    await submitSpot("user-1", submission);

    const payload = insertMock.mock.calls[0][0];
    expect(payload.possible_duplicate).toBe(false);
  });
});
