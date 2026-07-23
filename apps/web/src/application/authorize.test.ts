import { describe, expect, it } from "vitest";

import { authorize } from "./authorize";

describe("authorize", () => {
  it("rejects a denied product action without leaking policy details", async () => {
    await expect(
      authorize({ action: "catalog.publish" }, () => false),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "You do not have access to this action.",
    });
  });

  it("returns control when the product policy allows the action", async () => {
    await expect(
      authorize({ action: "catalog.read" }, () => true),
    ).resolves.toBeUndefined();
  });
});
