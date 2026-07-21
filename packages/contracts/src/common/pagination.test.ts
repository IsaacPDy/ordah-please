import { describe, expect, it } from "vitest";

import { parsePagination } from "./pagination.js";

describe("parsePagination", () => {
  it("uses bounded defaults when pagination fields are omitted", () => {
    expect(parsePagination({})).toEqual({ limit: 20, offset: 0 });
  });

  it("uses bounded defaults when pagination fields are explicitly undefined", () => {
    expect(parsePagination({ limit: undefined, offset: undefined })).toEqual({
      limit: 20,
      offset: 0,
    });
  });

  it("accepts integer pagination values at their upper bounds", () => {
    expect(parsePagination({ limit: 100, offset: 10_000 })).toEqual({
      limit: 100,
      offset: 10_000,
    });
  });

  it.each([0, 101, 1.5, Number.NaN, "20"])(
    "rejects invalid page limit %s",
    (limit) => {
      expect(() => parsePagination({ limit })).toThrowError(
        new TypeError("Pagination limit must be an integer from 1 to 100."),
      );
    },
  );

  it("rejects an explicit null limit instead of treating it as omitted", () => {
    expect(() => parsePagination({ limit: null })).toThrowError(
      new TypeError("Pagination limit must be an integer from 1 to 100."),
    );
  });

  it.each([-1, 10_001, 1.5, Number.NaN, "0"])(
    "rejects invalid page offset %s",
    (offset) => {
      expect(() => parsePagination({ offset })).toThrowError(
        new TypeError("Pagination offset must be an integer from 0 to 10000."),
      );
    },
  );

  it("rejects an explicit null offset instead of treating it as omitted", () => {
    expect(() => parsePagination({ offset: null })).toThrowError(
      new TypeError("Pagination offset must be an integer from 0 to 10000."),
    );
  });

  it.each([null, [], "", 20])(
    "rejects non-object pagination input %#",
    (value) => {
      expect(() => parsePagination(value)).toThrowError(
        new TypeError("Pagination input must be an object."),
      );
    },
  );
});
