import {
  parseCentavos,
  parseId,
  parseUtcTimestamp,
  type Centavos,
  type RecordId,
  type UtcTimestamp,
} from "@ordah-please/domain";

export type StrictObject = Readonly<Record<string, unknown>>;

/** Requires a plain JSON object and rejects arrays and null. */
export function parseStrictObject(value: unknown, label: string): StrictObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }

  return value as StrictObject;
}

/** Rejects fields that the API contract does not explicitly recognize. */
export function rejectUnknownFields(
  value: StrictObject,
  allowedFields: readonly string[],
  label: string,
): void {
  for (const key of Object.keys(value)) {
    if (!allowedFields.includes(key)) {
      throw new TypeError(`${label} contains unknown field: ${key}.`);
    }
  }
}

/** Reads a required non-blank string without changing imported wording. */
export function parseString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${label} must be a non-blank string.`);
  }

  return value;
}

/** Validates and brands a record identifier at the API boundary. */
export function parseRecordId<Id extends RecordId<string>>(
  value: unknown,
  label: string,
): Id {
  return parseId<Id>(parseString(value, label));
}

/** Validates integer Philippine centavos and returns the shared money brand. */
export function parseCentavosValue(value: unknown, label: string): Centavos {
  try {
    return parseCentavos(value);
  } catch {
    throw new TypeError(`${label} must be a non-negative safe integer.`);
  }
}

/** Reads either a non-blank string or the explicit absence marker null. */
export function parseNullableString(
  value: unknown,
  label: string,
): string | null {
  return value === null ? null : parseString(value, label);
}

/** Reads a required boolean field. */
export function parseBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new TypeError(`${label} must be a boolean.`);
  }

  return value;
}

/** Reads a non-negative safe integer used for quantities and centavos. */
export function parseNonNegativeInteger(value: unknown, label: string): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    Object.is(value, -0)
  ) {
    throw new TypeError(`${label} must be a non-negative safe integer.`);
  }

  return value;
}

/** Reads a positive safe integer used for selected quantities. */
export function parsePositiveInteger(value: unknown, label: string): number {
  const parsed = parseNonNegativeInteger(value, label);

  if (parsed === 0) {
    throw new TypeError(`${label} must be greater than zero.`);
  }

  return parsed;
}

/** Reads an array and validates every entry with the supplied parser. */
export function parseArray<Item>(
  value: unknown,
  label: string,
  parseItem: (item: unknown, index: number) => Item,
): readonly Item[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} must be an array.`);
  }

  return value.map(parseItem);
}

/** Reads a value from an exact string union. */
export function parseEnum<Value extends string>(
  value: unknown,
  allowedValues: readonly Value[],
  label: string,
): Value {
  if (typeof value !== "string" || !allowedValues.includes(value as Value)) {
    throw new TypeError(`${label} is not supported.`);
  }

  return value as Value;
}

/** Reads a canonical UTC timestamp string without converting it. */
export function parseUtcString(value: unknown, label: string): UtcTimestamp {
  try {
    return parseUtcTimestamp(value);
  } catch {
    throw new TypeError(`${label} must use canonical UTC ISO 8601 form.`);
  }
}
