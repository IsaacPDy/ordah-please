import type { OrderState } from "@ordah-please/domain";

const STATE_LABELS: Readonly<Record<OrderState, string>> = {
  draft: "Draft",
  cancelled: "Cancelled",
  food_confirmation: "Food picks",
  ordered: "Ordered",
  ready_for_handoff: "Handoff",
  restaurant_voting: "Voting",
};

/** Maps an order state to its member-facing label. */
export function formatStateLabel(state: OrderState): string {
  return STATE_LABELS[state];
}

/** Formats an instant in Philippine time for member-facing deadlines. */
export function formatDeadline(date: Date): string {
  const formatted = new Intl.DateTimeFormat("en-PH", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone: "Asia/Manila",
  }).format(date);
  return `${formatted} PHT`;
}
