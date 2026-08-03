import type {
  BranchId,
  FileId,
  FoodResponse,
  GroupId,
  HandoffLine,
  MemberSubtotal,
  MenuVersionId,
  OrderHandoff,
  OrderHistorySnapshot,
  OrderId,
  OrderParticipant,
  OrderReceipt,
  ManagerResolution,
  RestaurantChoiceMode,
  RestaurantId,
  RestaurantVote,
  UserId,
} from "@ordah-please/domain";

import {
  parseArray,
  parseCentavosValue,
  parseEnum,
  parseNullableString,
  parsePositiveInteger,
  parseRecordId,
  parseStrictObject,
  parseString,
  parseUtcString,
  rejectUnknownFields,
} from "../common/strict-boundary.js";
import { parseFoodSelectionSnapshot } from "./food-selection.js";

const orderRoles = ["participant", "manager"] as const;
const restaurantStatuses = ["pending", "responded"] as const;
const foodStatuses = ["pending", "confirmed", "declined", "resolved"] as const;

/** Parses the discriminated restaurant-choice configuration. */
function parseChoiceMode(value: unknown): RestaurantChoiceMode {
  const object = parseStrictObject(value, "Restaurant choice mode");
  const kind = parseEnum(
    object.kind,
    ["voting_disabled", "shortlist", "global_catalog"] as const,
    "Restaurant choice mode",
  );
  rejectUnknownFields(
    object,
    kind === "shortlist" ? ["kind", "restaurantIds"] : ["kind"],
    "Restaurant choice mode",
  );

  return kind === "shortlist"
    ? {
        kind,
        restaurantIds: parseArray(
          object.restaurantIds,
          "Shortlist restaurant ids",
          (item) =>
            parseRecordId<RestaurantId>(item, "Shortlist restaurant id"),
        ),
      }
    : { kind };
}

/** Parses one participant and both visible response statuses. */
function parseParticipant(value: unknown): OrderParticipant {
  const object = parseStrictObject(value, "Order participant");
  rejectUnknownFields(
    object,
    ["userId", "displayName", "role", "restaurantResponse", "foodResponse"],
    "Order participant",
  );

  return {
    userId: parseRecordId<UserId>(object.userId, "Participant user id"),
    displayName: parseString(object.displayName, "Participant display name"),
    role: parseEnum(object.role, orderRoles, "Participant role"),
    restaurantResponse: parseEnum(
      object.restaurantResponse,
      restaurantStatuses,
      "Participant restaurant response",
    ),
    foodResponse: parseEnum(
      object.foodResponse,
      foodStatuses,
      "Participant food response",
    ),
  };
}

/** Parses one restaurant vote captured with its submission time. */
function parseVote(value: unknown): RestaurantVote {
  const object = parseStrictObject(value, "Restaurant vote");
  rejectUnknownFields(
    object,
    ["userId", "restaurantId", "submittedAt"],
    "Restaurant vote",
  );

  return {
    userId: parseRecordId<UserId>(object.userId, "Vote user id"),
    restaurantId: parseRecordId<RestaurantId>(
      object.restaurantId,
      "Vote restaurant id",
    ),
    submittedAt: parseUtcString(object.submittedAt, "Vote submission time"),
  };
}

/** Parses a member's confirmed or declined food response. */
function parseFoodResponse(value: unknown): FoodResponse {
  const object = parseStrictObject(value, "Food response");
  const kind = parseEnum(
    object.kind,
    ["confirmed", "declined"] as const,
    "Food response kind",
  );
  rejectUnknownFields(
    object,
    kind === "confirmed"
      ? ["kind", "userId", "selection", "submittedAt"]
      : ["kind", "userId", "submittedAt"],
    "Food response",
  );

  return kind === "confirmed"
    ? {
        kind,
        userId: parseRecordId<UserId>(object.userId, "Food response user id"),
        selection: parseFoodSelectionSnapshot(object.selection),
        submittedAt: parseUtcString(
          object.submittedAt,
          "Food response submission time",
        ),
      }
    : {
        kind,
        userId: parseRecordId<UserId>(object.userId, "Food response user id"),
        submittedAt: parseUtcString(
          object.submittedAt,
          "Food response submission time",
        ),
      };
}

/** Parses one Manager decision made for a participant. */
function parseManagerResolution(value: unknown): ManagerResolution {
  const object = parseStrictObject(value, "Manager resolution");
  rejectUnknownFields(
    object,
    ["userId", "selection", "resolvedByUserId", "resolvedAt"],
    "Manager resolution",
  );

  return {
    userId: parseRecordId<UserId>(object.userId, "Resolved user id"),
    selection: parseFoodSelectionSnapshot(object.selection),
    resolvedByUserId: parseRecordId<UserId>(
      object.resolvedByUserId,
      "Resolving Manager id",
    ),
    resolvedAt: parseUtcString(object.resolvedAt, "Resolution time"),
  };
}

/** Parses one member's quantity contribution to a consolidated line. */
function parseMemberQuantity(
  value: unknown,
): Readonly<{ userId: UserId; quantity: number }> {
  const object = parseStrictObject(value, "Handoff member quantity");
  rejectUnknownFields(
    object,
    ["userId", "quantity"],
    "Handoff member quantity",
  );

  return {
    userId: parseRecordId<UserId>(object.userId, "Handoff member id"),
    quantity: parsePositiveInteger(object.quantity, "Handoff member quantity"),
  };
}

/** Parses one consolidated handoff line with exact member attribution. */
function parseHandoffLine(value: unknown): HandoffLine {
  const object = parseStrictObject(value, "Handoff line");
  rejectUnknownFields(
    object,
    [
      "itemName",
      "quantity",
      "unitPriceCentavos",
      "modifiers",
      "note",
      "memberQuantities",
      "lineSubtotalCentavos",
    ],
    "Handoff line",
  );

  return {
    itemName: parseString(object.itemName, "Handoff item name"),
    quantity: parsePositiveInteger(object.quantity, "Handoff quantity"),
    unitPriceCentavos: parseCentavosValue(
      object.unitPriceCentavos,
      "Handoff unit price",
    ),
    modifiers: parseArray(object.modifiers, "Handoff modifiers", (item) =>
      parseString(item, "Handoff modifier"),
    ),
    note:
      typeof object.note === "string"
        ? object.note
        : parseString(object.note, "Handoff note"),
    memberQuantities: parseArray(
      object.memberQuantities,
      "Handoff member quantities",
      parseMemberQuantity,
    ),
    lineSubtotalCentavos: parseCentavosValue(
      object.lineSubtotalCentavos,
      "Handoff line subtotal",
    ),
  };
}

/** Parses one member subtotal shown in the Manager handoff. */
function parseMemberBreakdown(value: unknown): MemberSubtotal {
  const object = parseStrictObject(value, "Member breakdown");
  rejectUnknownFields(
    object,
    ["userId", "displayName", "subtotalCentavos"],
    "Member breakdown",
  );

  return {
    userId: parseRecordId<UserId>(object.userId, "Member breakdown user id"),
    displayName: parseString(
      object.displayName,
      "Member breakdown display name",
    ),
    subtotalCentavos: parseCentavosValue(
      object.subtotalCentavos,
      "Member food subtotal",
    ),
  };
}

/** Parses the copyable manual-Grab handoff snapshot. */
function parseHandoff(value: unknown): OrderHandoff {
  const object = parseStrictObject(value, "Order handoff");
  rejectUnknownFields(
    object,
    [
      "lines",
      "memberBreakdown",
      "foodSubtotalCentavos",
      "copyableText",
      "grabUrl",
    ],
    "Order handoff",
  );

  return {
    lines: parseArray(object.lines, "Handoff lines", parseHandoffLine),
    memberBreakdown: parseArray(
      object.memberBreakdown,
      "Member breakdown",
      parseMemberBreakdown,
    ),
    foodSubtotalCentavos: parseCentavosValue(
      object.foodSubtotalCentavos,
      "Order food subtotal",
    ),
    copyableText: parseString(object.copyableText, "Copyable handoff text"),
    grabUrl: parseNullableString(object.grabUrl, "Grab branch URL"),
  };
}

/** Parses the optional-file receipt snapshot after manual ordering. */
function parseReceipt(value: unknown): OrderReceipt {
  const object = parseStrictObject(value, "Order receipt");
  rejectUnknownFields(object, ["fileId", "uploadedAt"], "Order receipt");

  return {
    fileId: parseRecordId<FileId>(object.fileId, "Receipt file id"),
    uploadedAt: parseUtcString(object.uploadedAt, "Receipt upload time"),
  };
}

/** Validates the immutable terminal-order record used by history screens and APIs. */
export function parseOrderHistorySnapshot(
  value: unknown,
): OrderHistorySnapshot {
  const object = parseStrictObject(value, "Order history snapshot");
  rejectUnknownFields(
    object,
    [
      "id",
      "groupId",
      "managerId",
      "state",
      "choiceMode",
      "initialRestaurantId",
      "selectedRestaurantId",
      "selectedRestaurantName",
      "selectedBranchId",
      "selectedBranchName",
      "menuVersionId",
      "deliveryAddress",
      "restaurantDeadline",
      "foodDeadline",
      "participants",
      "votes",
      "foodResponses",
      "managerResolutions",
      "handoff",
      "receipt",
      "createdAt",
      "completedAt",
    ],
    "Order history snapshot",
  );

  return {
    id: parseRecordId<OrderId>(object.id, "Order id"),
    groupId: parseRecordId<GroupId>(object.groupId, "Order group id"),
    managerId: parseRecordId<UserId>(object.managerId, "Order Manager id"),
    state: parseEnum(
      object.state,
      ["ordered", "cancelled"] as const,
      "Completed order state",
    ),
    choiceMode: parseChoiceMode(object.choiceMode),
    initialRestaurantId: parseRecordId<RestaurantId>(
      object.initialRestaurantId,
      "Initial restaurant id",
    ),
    selectedRestaurantId: parseRecordId<RestaurantId>(
      object.selectedRestaurantId,
      "Selected restaurant id",
    ),
    selectedRestaurantName: parseString(
      object.selectedRestaurantName,
      "Selected restaurant name",
    ),
    selectedBranchId: parseRecordId<BranchId>(
      object.selectedBranchId,
      "Selected branch id",
    ),
    selectedBranchName: parseString(
      object.selectedBranchName,
      "Selected branch name",
    ),
    menuVersionId: parseRecordId<MenuVersionId>(
      object.menuVersionId,
      "Order menu version id",
    ),
    deliveryAddress: parseString(
      object.deliveryAddress,
      "Order delivery address",
    ),
    restaurantDeadline: parseUtcString(
      object.restaurantDeadline,
      "Restaurant voting deadline",
    ),
    foodDeadline: parseUtcString(
      object.foodDeadline,
      "Food confirmation deadline",
    ),
    participants: parseArray(
      object.participants,
      "Order participants",
      parseParticipant,
    ),
    votes: parseArray(object.votes, "Restaurant votes", parseVote),
    foodResponses: parseArray(
      object.foodResponses,
      "Food responses",
      parseFoodResponse,
    ),
    managerResolutions: parseArray(
      object.managerResolutions,
      "Manager resolutions",
      parseManagerResolution,
    ),
    handoff: parseHandoff(object.handoff),
    receipt: object.receipt === null ? null : parseReceipt(object.receipt),
    createdAt: parseUtcString(object.createdAt, "Order creation time"),
    completedAt: parseUtcString(object.completedAt, "Order completion time"),
  };
}
