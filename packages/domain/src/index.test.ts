import { describe, expect, it } from "vitest";

describe("domain package public entry", () => {
  it("exports the shared runtime primitives", async () => {
    const publicEntry = await import("./index.js");

    expect(publicEntry.APPLICATION_ROLES).toEqual([
      "member",
      "manager",
      "group-owner",
      "platform-admin",
    ]);
    expect(publicEntry.ORDER_ROLES).toEqual(["participant", "manager"]);
    expect(typeof publicEntry.formatCentavos).toBe("function");
    expect(typeof publicEntry.parseCentavos).toBe("function");
    expect(typeof publicEntry.parseId).toBe("function");
    expect(typeof publicEntry.parseUtcTimestamp).toBe("function");
  });
});
