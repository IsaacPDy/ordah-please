import { describe, expect, it } from "vitest";

import {
  GROUP_NAME_MAX_LENGTH,
  validateGroupName,
} from "./group-details.js";

describe("validateGroupName", () => {
  it("accepts a non-empty name within the length cap", () => {
    expect(validateGroupName("Friends")).toBe("Friends");
  });

  it("trims surrounding whitespace before validating", () => {
    expect(validateGroupName("  Friends  ")).toBe("Friends");
  });

  it("rejects empty input", () => {
    expect(() => validateGroupName("")).toThrow(/name/i);
  });

  it("rejects whitespace-only input", () => {
    expect(() => validateGroupName("   ")).toThrow(/name/i);
  });

  it("rejects names longer than the cap", () => {
    const long = "a".repeat(GROUP_NAME_MAX_LENGTH + 1);
    expect(() => validateGroupName(long)).toThrow(/name/i);
  });

  it("accepts a name exactly at the length cap", () => {
    const exact = "a".repeat(GROUP_NAME_MAX_LENGTH);
    expect(validateGroupName(exact)).toBe(exact);
  });
});
