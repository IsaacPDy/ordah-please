import { describe, expect, it } from "vitest";

import * as domain from "../index.js";

type ResolveVote = (input: {
  selectedParticipantIds: readonly string[];
  initialRestaurantId: string;
  managerInitialVote: { userId: string; restaurantId: string };
  votes: readonly { userId: string; restaurantId: string }[];
}) => {
  restaurantId: string;
  reason: "threshold" | "initial_fallback" | "tie";
};

/** Loads the planned policy while keeping the first RED run executable. */
function policy(): ResolveVote {
  const candidate: unknown =
    "resolveRestaurantVote" in domain
      ? domain.resolveRestaurantVote
      : undefined;
  expect(candidate).toBeTypeOf("function");
  return candidate as ResolveVote;
}

describe("resolveRestaurantVote", () => {
  it("uses the initial restaurant below 50 percent", () => {
    expect(
      policy()({
        selectedParticipantIds: ["manager", "member-1", "member-2", "member-3"],
        initialRestaurantId: "initial",
        managerInitialVote: {
          userId: "manager",
          restaurantId: "initial",
        },
        votes: [],
      }),
    ).toEqual({ restaurantId: "initial", reason: "initial_fallback" });
  });

  it("lets the manager replace the initial vote and reach the threshold", () => {
    const resolve = policy();
    const baseVotes = [
      { userId: "manager", restaurantId: "alternative" },
      { userId: "member-1", restaurantId: "alternative" },
    ];

    expect(
      resolve({
        selectedParticipantIds: ["manager", "member-1", "member-2", "member-3"],
        initialRestaurantId: "initial",
        managerInitialVote: {
          userId: "manager",
          restaurantId: "initial",
        },
        votes: baseVotes,
      }),
    ).toEqual({ restaurantId: "alternative", reason: "threshold" });
    expect(
      resolve({
        selectedParticipantIds: ["manager", "member-1", "member-2", "member-3"],
        initialRestaurantId: "initial",
        managerInitialVote: {
          userId: "manager",
          restaurantId: "initial",
        },
        votes: [
          ...baseVotes,
          { userId: "member-2", restaurantId: "alternative" },
        ],
      }),
    ).toEqual({ restaurantId: "alternative", reason: "threshold" });
  });

  it("lets the initial restaurant win a tie", () => {
    expect(
      policy()({
        selectedParticipantIds: ["manager", "member-1", "member-2", "member-3"],
        initialRestaurantId: "initial",
        managerInitialVote: {
          userId: "manager",
          restaurantId: "initial",
        },
        votes: [
          { userId: "member-1", restaurantId: "initial" },
          { userId: "member-2", restaurantId: "alternative" },
          { userId: "member-3", restaurantId: "alternative" },
        ],
      }),
    ).toEqual({ restaurantId: "initial", reason: "tie" });
  });

  it("rejects votes from users outside the selected participant set", () => {
    expect(() =>
      policy()({
        selectedParticipantIds: ["manager", "member-1"],
        initialRestaurantId: "initial",
        managerInitialVote: {
          userId: "manager",
          restaurantId: "initial",
        },
        votes: [{ userId: "outsider", restaurantId: "alternative" }],
      }),
    ).toThrow("Only selected participants may vote.");
  });

  it("requires the manager's initial vote to belong to a selected participant and the initial restaurant", () => {
    const resolve = policy();
    const baseInput = {
      selectedParticipantIds: ["manager", "member-1"],
      initialRestaurantId: "initial",
      votes: [],
    } as const;

    expect(() =>
      resolve({
        ...baseInput,
        managerInitialVote: {
          userId: "outsider",
          restaurantId: "initial",
        },
      }),
    ).toThrow("The manager must be a selected participant.");
    expect(() =>
      resolve({
        ...baseInput,
        managerInitialVote: {
          userId: "manager",
          restaurantId: "alternative",
        },
      }),
    ).toThrow("The manager's initial vote must use the initial restaurant.");
  });

  it("requires at least one selected participant", () => {
    const managerInitialVote = {
      userId: "manager",
      restaurantId: "initial",
    } as const;

    expect(() =>
      policy()({
        selectedParticipantIds: [],
        initialRestaurantId: "initial",
        managerInitialVote,
        votes: [],
      }),
    ).toThrow("At least one selected participant is required.");
  });

  it("requires selected participant IDs to be unique", () => {
    const managerInitialVote = {
      userId: "manager",
      restaurantId: "initial",
    } as const;

    expect(() =>
      policy()({
        selectedParticipantIds: ["manager", "manager"],
        initialRestaurantId: "initial",
        managerInitialVote,
        votes: [],
      }),
    ).toThrow("Selected participant IDs must be unique.");
  });
});
