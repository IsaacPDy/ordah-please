import type {
  BranchId,
  DeliveryAddress,
  GroupId,
  RestaurantId,
  UserId,
  UtcTimestamp,
} from "@ordah-please/domain";

import {
  parseArray,
  parseBoolean,
  parseEnum,
  parseNullableString,
  parseRecordId,
  parseStrictObject,
  parseString,
  parseUtcString,
  rejectUnknownFields,
} from "../common/strict-boundary.js";

export type OrderCreateRequest = Readonly<{
  groupId: GroupId;
  participantUserIds: readonly UserId[];
  deliveryAddress: DeliveryAddress;
  saveAsGroupDefault: boolean;
  initialRestaurantId: RestaurantId;
  initialBranchId: BranchId;
  votingMode: "voting_disabled" | "shortlist" | "global_catalog";
  shortlistRestaurantIds: readonly RestaurantId[];
  restaurantDeadline: UtcTimestamp | null;
  foodDeadline: UtcTimestamp;
}>;

/** Parses and validates the delivery-address snapshot carried by order requests. */
export function parseDeliveryAddress(
  value: unknown,
  label: string,
): DeliveryAddress {
  const object = parseStrictObject(value, label);
  rejectUnknownFields(
    object,
    [
      "recipientName",
      "phoneNumber",
      "lineOne",
      "lineTwo",
      "city",
      "postalCode",
      "notes",
    ],
    label,
  );

  return {
    recipientName: parseString(object.recipientName, `${label} recipient name`),
    phoneNumber: parseString(object.phoneNumber, `${label} phone number`),
    lineOne: parseString(object.lineOne, `${label} first line`),
    lineTwo: parseNullableString(object.lineTwo, `${label} second line`),
    city: parseString(object.city, `${label} city`),
    postalCode: parseNullableString(object.postalCode, `${label} postal code`),
    notes: parseNullableString(object.notes, `${label} notes`),
  };
}

/** Parses the Manager's create-order request, including mode-dependent fields. */
export function parseOrderCreateRequest(value: unknown): OrderCreateRequest {
  const object = parseStrictObject(value, "Order create request");
  rejectUnknownFields(
    object,
    [
      "groupId",
      "participantUserIds",
      "deliveryAddress",
      "saveAsGroupDefault",
      "initialRestaurantId",
      "initialBranchId",
      "votingMode",
      "shortlistRestaurantIds",
      "restaurantDeadline",
      "foodDeadline",
    ],
    "Order create request",
  );

  const votingMode = parseEnum(
    object.votingMode,
    ["voting_disabled", "shortlist", "global_catalog"] as const,
    "Order voting mode",
  );

  const shortlistRaw =
    object.shortlistRestaurantIds === undefined
      ? []
      : parseArray(
          object.shortlistRestaurantIds,
          "Order shortlist restaurant ids",
          (item) =>
            parseRecordId<RestaurantId>(
              item,
              "Order shortlist restaurant id",
            ),
        );
  if (new Set(shortlistRaw).size !== shortlistRaw.length) {
    throw new TypeError("Order shortlist restaurant ids must be unique.");
  }
  if (votingMode !== "shortlist" && shortlistRaw.length > 0) {
    throw new TypeError(
      "Order shortlist restaurant ids are only allowed in shortlist mode.",
    );
  }

  const participantUserIds = parseArray(
    object.participantUserIds,
    "Order participant ids",
    (item) => parseRecordId<UserId>(item, "Order participant id"),
  );
  if (new Set(participantUserIds).size !== participantUserIds.length) {
    throw new TypeError("Order participant ids must be unique.");
  }

  const restaurantDeadline =
    object.restaurantDeadline === undefined || object.restaurantDeadline === null
      ? null
      : parseUtcString(object.restaurantDeadline, "Order voting deadline");
  if (votingMode === "voting_disabled" && restaurantDeadline !== null) {
    throw new TypeError(
      "Order voting deadline is not allowed when voting is disabled.",
    );
  }
  if (votingMode !== "voting_disabled" && restaurantDeadline === null) {
    throw new TypeError("Order voting deadline is required for voting modes.");
  }

  return {
    groupId: parseRecordId<GroupId>(object.groupId, "Order group id"),
    participantUserIds,
    deliveryAddress: parseDeliveryAddress(
      object.deliveryAddress,
      "Order delivery address",
    ),
    saveAsGroupDefault: parseBoolean(
      object.saveAsGroupDefault,
      "Order save-address flag",
    ),
    initialRestaurantId: parseRecordId<RestaurantId>(
      object.initialRestaurantId,
      "Order fallback restaurant id",
    ),
    initialBranchId: parseRecordId<BranchId>(
      object.initialBranchId,
      "Order fallback branch id",
    ),
    votingMode,
    shortlistRestaurantIds: shortlistRaw,
    restaurantDeadline,
    foodDeadline: parseUtcString(object.foodDeadline, "Order food deadline"),
  };
}
