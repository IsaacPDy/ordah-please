import { describe, expect, it } from "vitest";

import * as domain from "../index.js";

const orderStates = [
  "draft",
  "restaurant_voting",
  "food_confirmation",
  "ready_for_handoff",
  "ordered",
  "cancelled",
] as const;

const allowedTransitions = new Set([
  "draft:restaurant_voting",
  "draft:food_confirmation",
  "draft:cancelled",
  "restaurant_voting:food_confirmation",
  "restaurant_voting:cancelled",
  "food_confirmation:ready_for_handoff",
  "food_confirmation:cancelled",
  "ready_for_handoff:ordered",
  "ready_for_handoff:cancelled",
]);

type Transition = (
  current: string,
  target: string,
) => { state: string; changed: boolean };

/** Loads the planned policy while keeping the first RED run executable. */
function policy(): Transition {
  const candidate: unknown =
    "transitionOrderState" in domain ? domain.transitionOrderState : undefined;
  expect(candidate).toBeTypeOf("function");
  return candidate as Transition;
}

describe("transitionOrderState", () => {
  it.each([
    ["draft", "restaurant_voting"],
    ["draft", "food_confirmation"],
    ["restaurant_voting", "food_confirmation"],
    ["food_confirmation", "ready_for_handoff"],
    ["ready_for_handoff", "ordered"],
    ["draft", "cancelled"],
    ["restaurant_voting", "cancelled"],
    ["food_confirmation", "cancelled"],
    ["ready_for_handoff", "cancelled"],
  ])("allows %s to transition to %s", (current, target) => {
    expect(policy()(current, target)).toEqual({ state: target, changed: true });
  });

  it.each(orderStates)(
    "treats repeated %s transitions as idempotent",
    (state) => {
      expect(policy()(state, state)).toEqual({
        state,
        changed: false,
      });
    },
  );

  const rejectedTransitions = orderStates.flatMap((current) =>
    orderStates
      .filter(
        (target) =>
          target !== current && !allowedTransitions.has(`${current}:${target}`),
      )
      .map((target) => [current, target] as const),
  );

  it.each(rejectedTransitions)("rejects %s to %s", (current, target) => {
    expect(() => policy()(current, target)).toThrow(
      `Order cannot transition from ${current} to ${target}.`,
    );
  });
});
