import { describe, it, expect } from "vitest";
import {
  LIMITS,
  USERNAME_RE,
  capText,
  capOrNull,
  normalizeUsername,
  sanitizeSearchQuery,
  isValidLatitude,
  isValidLongitude,
} from "@/lib/validation";

describe("capText", () => {
  it("trims surrounding whitespace", () => {
    expect(capText("  hello  ", 100)).toBe("hello");
  });

  it("caps to the max length", () => {
    expect(capText("abcdef", 3)).toBe("abc");
  });
});

describe("capOrNull", () => {
  it("returns null for empty/whitespace-only input", () => {
    expect(capOrNull("   ", 100)).toBeNull();
  });

  it("returns the capped string otherwise", () => {
    expect(capOrNull("  skate  ", 100)).toBe("skate");
  });
});

describe("normalizeUsername", () => {
  it("strips disallowed characters", () => {
    expect(normalizeUsername("dan.smith+news@x")).toBe("dan.smithnewsx");
  });

  it("falls back to 'skater' when nothing usable remains", () => {
    expect(normalizeUsername("!@#$%")).toBe("skater");
  });

  it("caps to the username limit", () => {
    const long = "a".repeat(50);
    expect(normalizeUsername(long)).toHaveLength(LIMITS.username);
  });
});

describe("USERNAME_RE", () => {
  it("accepts valid usernames", () => {
    expect(USERNAME_RE.test("skate_boarder")).toBe(true);
    expect(USERNAME_RE.test("Tony.Hawk-900")).toBe(true);
  });

  it("rejects too-short, too-long, or illegal usernames", () => {
    expect(USERNAME_RE.test("ab")).toBe(false); // too short
    expect(USERNAME_RE.test("a".repeat(31))).toBe(false); // too long
    expect(USERNAME_RE.test("has space")).toBe(false);
    expect(USERNAME_RE.test("emoji🛹here")).toBe(false);
  });
});

describe("sanitizeSearchQuery", () => {
  it("removes PostgREST filter metacharacters", () => {
    expect(sanitizeSearchQuery("a,b)c(*:d")).toBe("a b c d");
  });

  it("collapses whitespace and trims", () => {
    expect(sanitizeSearchQuery("  venice   beach ")).toBe("venice beach");
  });

  it("cannot inject an extra .or() clause", () => {
    // A comma would otherwise start a new filter term in PostgREST.
    expect(sanitizeSearchQuery("x,is_admin.eq.true")).not.toContain(",");
  });
});

describe("coordinate validators", () => {
  it("accepts in-range values", () => {
    expect(isValidLatitude(34.05)).toBe(true);
    expect(isValidLongitude(-118.24)).toBe(true);
  });

  it("rejects out-of-range or non-finite values", () => {
    expect(isValidLatitude(91)).toBe(false);
    expect(isValidLatitude(NaN)).toBe(false);
    expect(isValidLongitude(-181)).toBe(false);
    expect(isValidLongitude(Infinity)).toBe(false);
  });
});
