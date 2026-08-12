import { parseArray, parseString } from "./strict-boundary.js";

/** Parses a string array field; used for cuisines and similar tags. */
export function parseStringArray(
  value: unknown,
  label: string,
): readonly string[] {
  return parseArray(value, label, (entry, index) =>
    parseString(entry, `${label} entry ${index}`),
  );
}
