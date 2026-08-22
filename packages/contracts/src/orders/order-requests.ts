import type {
  FavoriteId,
  FoodSelectionSnapshot,
  OrderId,
  RestaurantId,
  UserId,
} from "@ordah-please/domain";

import {
  parseEnum,
  parseRecordId,
  parseStrictObject,
  rejectUnknownFields,
} from "../common/strict-boundary.js";
import { parseFoodSelectionSnapshot } from "./food-selection.js";

export type SubmitRestaurantVoteRequest = Readonly<{
  orderId: OrderId;
  restaurantId: RestaurantId;
}>;

export type SubmitFoodResponseRequest = Readonly<{
  orderId: OrderId;
  response:
    | Readonly<{ kind: "confirmed"; selection: FoodSelectionSnapshot }>
    | Readonly<{ kind: "declined" }>;
}>;

export type ManagerResolutionRequest = Readonly<{
  orderId: OrderId;
  userId: UserId;
  selection: FoodSelectionSnapshot;
}>;

export type FoodPickRequest = Readonly<
  | { kind: "favorite"; favoriteId: FavoriteId }
  | { kind: "declined" }
  | { kind: "clear" }
>;

/** Validates the authenticated member's restaurant vote request. */
export function parseSubmitRestaurantVoteRequest(
  value: unknown,
): SubmitRestaurantVoteRequest {
  const object = parseStrictObject(value, "Restaurant vote request");
  rejectUnknownFields(
    object,
    ["orderId", "restaurantId"],
    "Restaurant vote request",
  );

  return {
    orderId: parseRecordId<OrderId>(object.orderId, "Vote order id"),
    restaurantId: parseRecordId<RestaurantId>(
      object.restaurantId,
      "Voted restaurant id",
    ),
  };
}

/** Validates the authenticated member's confirm-or-decline food request. */
export function parseSubmitFoodResponseRequest(
  value: unknown,
): SubmitFoodResponseRequest {
  const object = parseStrictObject(value, "Food response request");
  rejectUnknownFields(object, ["orderId", "response"], "Food response request");
  const response = parseStrictObject(
    object.response,
    "Food response request body",
  );
  const kind = parseEnum(
    response.kind,
    ["confirmed", "declined"] as const,
    "Food response request kind",
  );
  rejectUnknownFields(
    response,
    kind === "confirmed" ? ["kind", "selection"] : ["kind"],
    "Food response request body",
  );

  return {
    orderId: parseRecordId<OrderId>(object.orderId, "Food response order id"),
    response:
      kind === "confirmed"
        ? { kind, selection: parseFoodSelectionSnapshot(response.selection) }
        : { kind },
  };
}

/** Validates a Manager's food choice for one unresolved participant. */
export function parseManagerResolutionRequest(
  value: unknown,
): ManagerResolutionRequest {
  const object = parseStrictObject(value, "Manager resolution request");
  rejectUnknownFields(
    object,
    ["orderId", "userId", "selection"],
    "Manager resolution request",
  );

  return {
    orderId: parseRecordId<OrderId>(object.orderId, "Resolution order id"),
    userId: parseRecordId<UserId>(object.userId, "Resolved participant id"),
    selection: parseFoodSelectionSnapshot(object.selection),
  };
}

/** Validates the member's favorites-only food pick body sent to the order page. */
export function parseFoodPickRequest(value: unknown): FoodPickRequest {
  const object = parseStrictObject(value, "Food pick request");
  const kind = parseEnum(
    object.kind,
    ["favorite", "declined", "clear"] as const,
    "Food pick request kind",
  );
  rejectUnknownFields(
    object,
    kind === "favorite" ? ["kind", "favoriteId"] : ["kind"],
    "Food pick request",
  );

  if (kind !== "favorite") {
    return { kind };
  }
  return {
    kind,
    favoriteId: parseRecordId<FavoriteId>(
      object.favoriteId,
      "Food pick favorite id",
    ),
  };
}
