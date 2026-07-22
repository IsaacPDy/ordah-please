import { describe, expect, it } from "vitest";

describe("web server test foundation", () => {
  it("keeps browser-only globals out of server tests", () => {
    expect("window" in globalThis).toBe(false);
  });
});
