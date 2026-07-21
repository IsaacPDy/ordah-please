import { describe, expect, it } from "vitest";

import { parseUtcTimestamp } from "./time.js";

describe("parseUtcTimestamp", () => {
  it("accepts and preserves an ISO timestamp expressed in UTC", () => {
    const value = "2026-07-21T06:30:45.123Z";

    expect(parseUtcTimestamp(value)).toBe(value);
  });

  it.each([
    "2026-07-21T14:30:45.123+08:00",
    "2026-02-30T06:30:45.123Z",
    "2026-99-21T06:30:45.123Z",
    "not-a-time",
    "",
  ])("rejects non-canonical UTC timestamp %s", (value) => {
    expect(() => parseUtcTimestamp(value)).toThrowError(
      new TypeError("UTC timestamp must use canonical ISO 8601 form."),
    );
  });
});
