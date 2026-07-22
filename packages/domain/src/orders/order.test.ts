import { describe, expect, it } from "vitest";

import * as domain from "../index.js";

describe("order contract constants", () => {
  it("publishes every V1 order state in workflow order", () => {
    expect(Reflect.get(domain, "ORDER_STATES")).toEqual([
      "draft",
      "restaurant_voting",
      "food_confirmation",
      "ready_for_handoff",
      "ordered",
      "cancelled",
    ]);
  });

  it("publishes the three restaurant choice modes", () => {
    expect(Reflect.get(domain, "RESTAURANT_CHOICE_MODES")).toEqual([
      "voting_disabled",
      "shortlist",
      "global_catalog",
    ]);
  });
});
