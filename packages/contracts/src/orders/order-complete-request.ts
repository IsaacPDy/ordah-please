import {
  parseEnum,
  parseStrictObject,
  rejectUnknownFields,
} from "../common/strict-boundary.js";

export type OrderCompleteRequest = Readonly<{
  result: "ordered" | "cancelled";
}>;

/** Parses the Manager's order completion request. */
export function parseOrderCompleteRequest(
  value: unknown,
): OrderCompleteRequest {
  const object = parseStrictObject(value, "Order complete request");
  rejectUnknownFields(object, ["result"], "Order complete request");

  return {
    result: parseEnum(
      object.result,
      ["ordered", "cancelled"] as const,
      "Order completion result",
    ),
  };
}
