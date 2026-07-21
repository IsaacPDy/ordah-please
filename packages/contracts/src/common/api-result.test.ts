import { describe, expect, it } from "vitest";

import { apiFailure, apiSuccess } from "./api-result.js";
import { PublicApiError } from "./errors.js";

describe("API results", () => {
  it("wraps successful data in the typed success envelope", () => {
    expect(apiSuccess({ orderId: "order-1" })).toEqual({
      data: { orderId: "order-1" },
      ok: true,
    });
  });

  it("wraps a safely serialized error in the typed failure envelope", () => {
    expect(
      apiFailure(new PublicApiError("FORBIDDEN", "Access denied.")),
    ).toEqual({
      error: { code: "FORBIDDEN", message: "Access denied." },
      ok: false,
    });
  });
});
