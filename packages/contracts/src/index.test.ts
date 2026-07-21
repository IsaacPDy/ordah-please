import { describe, expect, it } from "vitest";

describe("contracts package public entry", () => {
  it("exports the shared API and pagination primitives", async () => {
    const publicEntry = await import("./index.js");

    expect(Array.isArray(publicEntry.API_ERROR_CODES)).toBe(true);
    expect(publicEntry.DEFAULT_PAGE_LIMIT).toBe(20);
    expect(publicEntry.MAX_PAGE_LIMIT).toBe(100);
    expect(publicEntry.MAX_PAGE_OFFSET).toBe(10_000);
    expect(typeof publicEntry.PublicApiError).toBe("function");
    expect(typeof publicEntry.apiFailure).toBe("function");
    expect(typeof publicEntry.apiSuccess).toBe("function");
    expect(typeof publicEntry.parsePagination).toBe("function");
    expect(typeof publicEntry.serializeApiError).toBe("function");
  });
});
