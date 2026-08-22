import { describe, expect, it } from "vitest";

import { formatDeadline, formatStateLabel } from "./order-format.js";

describe("order formatting", () => {
  it("formats deadlines in Philippine time with a PHT label", () => {
    expect(
      formatDeadline(new Date("2026-08-20T03:30:00.000Z")),
    ).toContain("11:30");
    expect(formatDeadline(new Date("2026-08-20T03:30:00.000Z"))).toContain(
      "PHT",
    );
  });

  it("maps every state to its member-facing label", () => {
    expect(formatStateLabel("restaurant_voting")).toBe("Voting");
    expect(formatStateLabel("food_confirmation")).toBe("Food picks");
    expect(formatStateLabel("ready_for_handoff")).toBe("Handoff");
    expect(formatStateLabel("ordered")).toBe("Ordered");
    expect(formatStateLabel("cancelled")).toBe("Cancelled");
  });
});
