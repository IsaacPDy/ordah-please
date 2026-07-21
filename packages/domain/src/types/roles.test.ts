import { describe, expect, it } from "vitest";

import { APPLICATION_ROLES, ORDER_ROLES } from "./roles.js";

describe("role unions", () => {
  it("lists every canonical application role", () => {
    expect(APPLICATION_ROLES).toEqual([
      "member",
      "organizer",
      "group-owner",
      "platform-admin",
    ]);
  });

  it("lists every canonical order role", () => {
    expect(ORDER_ROLES).toEqual(["participant", "organizer"]);
  });
});
