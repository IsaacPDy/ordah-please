import { describe, expect, it } from "vitest";

import { createWebAuthClient } from "./auth-client";

describe("web auth client", () => {
  it("exposes only the approved session capabilities", () => {
    const client = createWebAuthClient("https://example.test");

    expect(Object.keys(client).sort()).toEqual([
      "signIn",
      "signOut",
      "useSession",
    ]);
    expect(Object.keys(client.signIn)).toEqual(["social"]);
    expect(client.signIn.social).toBeTypeOf("function");
    expect(client.signOut).toBeTypeOf("function");
    expect(client.useSession).toBeTypeOf("function");
  });
});
