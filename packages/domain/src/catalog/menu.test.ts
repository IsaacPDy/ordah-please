import { describe, expect, it } from "vitest";

import * as domain from "../index.js";

describe("catalog contract constants", () => {
  it("publishes every supported availability state", () => {
    expect(Reflect.get(domain, "MENU_AVAILABILITY_STATES")).toEqual([
      "available",
      "unavailable",
    ]);
  });
});
