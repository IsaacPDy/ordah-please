import { describe, expect, it } from "vitest";

import { parseFavoriteSaveRequest } from "./favorite-save-request.js";

describe("parseFavoriteSaveRequest", () => {
  it("accepts a request with one menu item id", () => {
    expect(
      parseFavoriteSaveRequest({ menuItemId: "item-1" }),
    ).toStrictEqual({ menuItemId: "item-1" });
  });

  it("rejects a missing menu item id", () => {
    expect(() => parseFavoriteSaveRequest({})).toThrow(TypeError);
  });

  it("rejects a non-string menu item id", () => {
    expect(() => parseFavoriteSaveRequest({ menuItemId: 42 })).toThrow(
      TypeError,
    );
  });

  it("rejects unknown fields", () => {
    expect(() =>
      parseFavoriteSaveRequest({ menuItemId: "item-1", rank: 1 }),
    ).toThrow(TypeError);
  });

  it("rejects non-object input", () => {
    expect(() => parseFavoriteSaveRequest(null)).toThrow(TypeError);
  });
});
