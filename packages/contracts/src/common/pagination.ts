export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;
export const MAX_PAGE_OFFSET = 10_000;

export type Pagination = Readonly<{
  limit: number;
  offset: number;
}>;

/** Validates page controls so list requests cannot become unbounded queries. */
export function parsePagination(value: unknown): Pagination {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Pagination input must be an object.");
  }

  const input = value as {
    readonly limit?: unknown;
    readonly offset?: unknown;
  };
  const limit = input.limit === undefined ? DEFAULT_PAGE_LIMIT : input.limit;
  const offset = input.offset === undefined ? 0 : input.offset;

  if (
    typeof limit !== "number" ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > MAX_PAGE_LIMIT
  ) {
    throw new TypeError("Pagination limit must be an integer from 1 to 100.");
  }

  if (
    typeof offset !== "number" ||
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset > MAX_PAGE_OFFSET
  ) {
    throw new TypeError(
      "Pagination offset must be an integer from 0 to 10000.",
    );
  }

  return {
    limit,
    offset,
  };
}
