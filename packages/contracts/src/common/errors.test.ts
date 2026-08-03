import { describe, expect, it } from "vitest";

import {
  API_ERROR_CODES,
  PublicApiError,
  serializeApiError,
} from "./errors.js";

describe("API errors", () => {
  it("publishes the complete stable error-code set", () => {
    expect(API_ERROR_CODES).toEqual([
      "UNAUTHENTICATED",
      "FORBIDDEN",
      "NOT_FOUND",
      "INVALID_INPUT",
      "CONFLICT",
      "UNAVAILABLE",
      "INTERNAL_FAILURE",
    ]);
  });

  it("serializes an explicitly public application error deterministically", () => {
    expect(
      serializeApiError(
        new PublicApiError("CONFLICT", "The record changed; retry."),
      ),
    ).toEqual({
      code: "CONFLICT",
      message: "The record changed; retry.",
    });
  });

  it.each([
    new Error("password=secret; SELECT * FROM users"),
    { code: "FORBIDDEN", message: "forged public error" },
    "provider rejected token secret-token",
  ])("replaces an untrusted error with one safe response", (error) => {
    expect(serializeApiError(error)).toEqual({
      code: "INTERNAL_FAILURE",
      message: "Something went wrong.",
    });
  });
});
