import { describe, it, expect } from "vitest";
import { STATE_NAMES, stateFromCoords, isStateCode } from "@/lib/usStates";

describe("STATE_NAMES", () => {
  it("covers 50 states + DC", () => {
    expect(Object.keys(STATE_NAMES)).toHaveLength(51);
    expect(STATE_NAMES.CA).toBe("California");
    expect(STATE_NAMES.DC).toBe("District of Columbia");
  });
});

describe("isStateCode", () => {
  it("accepts valid 2-letter codes", () => {
    expect(isStateCode("CA")).toBe(true);
    expect(isStateCode("GA")).toBe(true);
  });

  it("rejects unknown or malformed tokens", () => {
    expect(isStateCode("XX")).toBe(false);
    expect(isStateCode("ca")).toBe(false); // must be uppercase
    expect(isStateCode("California")).toBe(false);
  });
});

describe("stateFromCoords", () => {
  it("resolves Los Angeles to CA", () => {
    expect(stateFromCoords(34.05, -118.24)).toBe("CA");
  });

  it("resolves Atlanta to GA", () => {
    expect(stateFromCoords(33.75, -84.39)).toBe("GA");
  });

  it("returns null for coordinates outside the US", () => {
    expect(stateFromCoords(0, 0)).toBeNull();
  });
});
