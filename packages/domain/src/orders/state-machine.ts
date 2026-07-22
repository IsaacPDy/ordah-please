import type { OrderState } from "./order.js";

const allowedTargets: Readonly<Record<OrderState, readonly OrderState[]>> = {
  draft: ["restaurant_voting", "food_confirmation", "cancelled"],
  restaurant_voting: ["food_confirmation", "cancelled"],
  food_confirmation: ["ready_for_handoff", "cancelled"],
  ready_for_handoff: ["ordered", "cancelled"],
  ordered: [],
  cancelled: [],
};

/** Validates one order-state change and makes repeated calls idempotent. */
export function transitionOrderState(
  current: OrderState,
  target: OrderState,
): Readonly<{ state: OrderState; changed: boolean }> {
  if (current === target) {
    return { state: current, changed: false };
  }

  if (!allowedTargets[current].includes(target)) {
    throw new Error(`Order cannot transition from ${current} to ${target}.`);
  }

  return { state: target, changed: true };
}
