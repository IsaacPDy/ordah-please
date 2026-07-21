import { describe, expect, it } from "vitest";

import { parseId, type UserId } from "./ids.js";

describe("parseId", () => {
  it("preserves a non-blank imported identifier exactly", () => {
    const value = "  external-user-id  ";

    expect(parseId<UserId>(value)).toBe(value);
  });

  it("rejects blank identifiers at the validation boundary", () => {
    expect(() => parseId<UserId>(" \t\n ")).toThrowError(
      new TypeError("Record ID must be a non-blank string."),
    );
  });
});
