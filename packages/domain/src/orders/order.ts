import type {
  BranchId,
  FavoriteId,
  FileId,
  GroupId,
  MenuVersionId,
  OrderId,
  RestaurantId,
  UserId,
} from "../types/ids.js";
import type { Centavos } from "../types/money.js";
import type { OrderRole } from "../types/roles.js";
import type { UtcTimestamp } from "../types/time.js";

export const ORDER_STATES = [
  "draft",
  "restaurant_voting",
  "food_confirmation",
  "ready_for_handoff",
  "ordered",
  "cancelled",
] as const;

export type OrderState = (typeof ORDER_STATES)[number];

export const RESTAURANT_CHOICE_MODES = [
  "voting_disabled",
  "shortlist",
  "global_catalog",
] as const;

export type RestaurantChoiceMode =
  | Readonly<{ kind: "voting_disabled" }>
  | Readonly<{ kind: "shortlist"; restaurantIds: readonly RestaurantId[] }>
  | Readonly<{ kind: "global_catalog" }>;

export type ParticipantStatus = "pending" | "responded";
export type FoodParticipantStatus =
  "pending" | "confirmed" | "declined" | "resolved";

export type OrderParticipant = Readonly<{
  userId: UserId;
  displayName: string;
  role: OrderRole;
  restaurantResponse: ParticipantStatus;
  foodResponse: FoodParticipantStatus;
}>;

export type RestaurantVote = Readonly<{
  userId: UserId;
  restaurantId: RestaurantId;
  submittedAt: UtcTimestamp;
}>;

export type SelectedVariantSnapshot = Readonly<{
  menuVariantId: import("../types/ids.js").MenuVariantId;
  name: string;
  priceDeltaCentavos: Centavos;
}>;

export type SelectedModifierSnapshot = Readonly<{
  menuModifierOptionId: import("../types/ids.js").MenuModifierOptionId;
  name: string;
  quantity: number;
  priceDeltaCentavos: Centavos;
}>;

export type SelectedItemSnapshot = Readonly<{
  menuItemId: import("../types/ids.js").MenuItemId;
  name: string;
  quantity: number;
  unitPriceCentavos: Centavos;
  variant: SelectedVariantSnapshot | null;
  modifiers: readonly SelectedModifierSnapshot[];
  note: string;
}>;

export type FoodSelectionSnapshot = Readonly<{
  source:
    | Readonly<{ kind: "saved_favorite"; favoriteId: FavoriteId }>
    | Readonly<{ kind: "inline" }>;
  items: readonly SelectedItemSnapshot[];
}>;

export type FoodResponse =
  | Readonly<{
      kind: "confirmed";
      userId: UserId;
      selection: FoodSelectionSnapshot;
      submittedAt: UtcTimestamp;
    }>
  | Readonly<{
      kind: "declined";
      userId: UserId;
      submittedAt: UtcTimestamp;
    }>;

export type ManagerResolution = Readonly<{
  userId: UserId;
  selection: FoodSelectionSnapshot;
  resolvedByUserId: UserId;
  resolvedAt: UtcTimestamp;
}>;

export type HandoffLine = Readonly<{
  itemName: string;
  quantity: number;
  unitPriceCentavos: Centavos;
  modifiers: readonly string[];
  note: string;
  memberQuantities: readonly Readonly<{ userId: UserId; quantity: number }>[];
  lineSubtotalCentavos: Centavos;
}>;

export type MemberSubtotal = Readonly<{
  userId: UserId;
  displayName: string;
  subtotalCentavos: Centavos;
}>;

export type OrderHandoff = Readonly<{
  lines: readonly HandoffLine[];
  memberBreakdown: readonly MemberSubtotal[];
  foodSubtotalCentavos: Centavos;
  copyableText: string;
  grabUrl: string | null;
}>;

export type OrderReceipt = Readonly<{
  fileId: FileId;
  uploadedAt: UtcTimestamp;
}>;

export type OrderHistorySnapshot = Readonly<{
  id: OrderId;
  groupId: GroupId;
  managerId: UserId;
  state: Extract<OrderState, "ordered" | "cancelled">;
  choiceMode: RestaurantChoiceMode;
  initialRestaurantId: RestaurantId;
  selectedRestaurantId: RestaurantId;
  selectedRestaurantName: string;
  selectedBranchId: BranchId;
  selectedBranchName: string;
  menuVersionId: MenuVersionId;
  deliveryAddress: string;
  restaurantDeadline: UtcTimestamp;
  foodDeadline: UtcTimestamp;
  participants: readonly OrderParticipant[];
  votes: readonly RestaurantVote[];
  foodResponses: readonly FoodResponse[];
  managerResolutions: readonly ManagerResolution[];
  handoff: OrderHandoff;
  receipt: OrderReceipt | null;
  createdAt: UtcTimestamp;
  completedAt: UtcTimestamp;
}>;
