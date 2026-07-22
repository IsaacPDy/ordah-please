import { describe, expect, it } from "vitest";

describe("domain package test foundation", () => {
  it("loads the public package entry through the TypeScript test pipeline", async () => {
    const publicEntry = await import("./index.js");

    expect(Object.keys(publicEntry)).toEqual([]);
  });
});
