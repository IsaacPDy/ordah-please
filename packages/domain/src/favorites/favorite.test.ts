import { describe, expect, it } from "vitest";

import * as domain from "../index.js";

describe("favorite contract constants", () => {
  it("publishes exactly the three supported favorite ranks", () => {
    expect(Reflect.get(domain, "FAVORITE_RANKS")).toEqual([1, 2, 3]);
  });
});
