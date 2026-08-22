import { describe, expect, it } from "vitest";

import { parseOrderCompleteRequest } from "./order-complete-request.js";

describe("parseOrderCompleteRequest", () => {
  it("parses ordered and cancelled results", () => {
    expect(parseOrderCompleteRequest({ result: "ordered" }).result).toBe(
      "ordered",
    );
    expect(parseOrderCompleteRequest({ result: "cancelled" }).result).toBe(
      "cancelled",
    );
  });

  it("rejects other results and unknown fields", () => {
    expect(() => parseOrderCompleteRequest({ result: "deleted" })).toThrow(
      TypeError,
    );
    expect(() =>
      parseOrderCompleteRequest({ result: "ordered", extra: 1 }),
    ).toThrow(TypeError);
  });
});
