declare const utcTimestampBrand: unique symbol;

export type UtcTimestamp = string & {
  readonly [utcTimestampBrand]: "utc-timestamp";
};

const canonicalUtcTimestampPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** Validates an external timestamp before it enters the domain as UTC time. */
export function parseUtcTimestamp(value: unknown): UtcTimestamp {
  const milliseconds = typeof value === "string" ? Date.parse(value) : NaN;

  if (
    typeof value !== "string" ||
    !canonicalUtcTimestampPattern.test(value) ||
    !Number.isFinite(milliseconds) ||
    new Date(milliseconds).toISOString() !== value
  ) {
    throw new TypeError("UTC timestamp must use canonical ISO 8601 form.");
  }

  return value as UtcTimestamp;
}
