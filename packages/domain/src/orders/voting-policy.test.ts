import { describe, expect, it } from "vitest";

import * as domain from "../index.js";

type ResolveVote = (input: {
  selectedParticipantIds: readonly string[];
  initialRestaurantId: string;
  organizerInitialVote: { userId: string; restaurantId: string };
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
        selectedParticipantIds: [
          "organizer",
          "member-1",
          "member-2",
          "member-3",
        ],
        initialRestaurantId: "initial",
        organizerInitialVote: {
          userId: "organizer",
          restaurantId: "initial",
        },
        votes: [],
      }),
    ).toEqual({ restaurantId: "initial", reason: "initial_fallback" });
  });

  it("lets the organizer replace the initial vote and reach the threshold", () => {
    const resolve = policy();
    const baseVotes = [
      { userId: "organizer", restaurantId: "alternative" },
      { userId: "member-1", restaurantId: "alternative" },
    ];

    expect(
      resolve({
        selectedParticipantIds: [
          "organizer",
          "member-1",
          "member-2",
          "member-3",
        ],
        initialRestaurantId: "initial",
        organizerInitialVote: {
          userId: "organizer",
          restaurantId: "initial",
        },
        votes: baseVotes,
      }),
    ).toEqual({ restaurantId: "alternative", reason: "threshold" });
    expect(
      resolve({
        selectedParticipantIds: [
          "organizer",
          "member-1",
          "member-2",
          "member-3",
        ],
        initialRestaurantId: "initial",
        organizerInitialVote: {
          userId: "organizer",
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
        selectedParticipantIds: [
          "organizer",
          "member-1",
          "member-2",
          "member-3",
        ],
        initialRestaurantId: "initial",
        organizerInitialVote: {
          userId: "organizer",
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
        selectedParticipantIds: ["organizer", "member-1"],
        initialRestaurantId: "initial",
        organizerInitialVote: {
          userId: "organizer",
          restaurantId: "initial",
        },
        votes: [{ userId: "outsider", restaurantId: "alternative" }],
      }),
    ).toThrow("Only selected participants may vote.");
  });

  it("requires the organizer's initial vote to belong to a selected participant and the initial restaurant", () => {
    const resolve = policy();
    const baseInput = {
      selectedParticipantIds: ["organizer", "member-1"],
      initialRestaurantId: "initial",
      votes: [],
    } as const;

    expect(() =>
      resolve({
        ...baseInput,
        organizerInitialVote: {
          userId: "outsider",
          restaurantId: "initial",
        },
      }),
    ).toThrow("The organizer must be a selected participant.");
    expect(() =>
      resolve({
        ...baseInput,
        organizerInitialVote: {
          userId: "organizer",
          restaurantId: "alternative",
        },
      }),
    ).toThrow("The organizer's initial vote must use the initial restaurant.");
  });

  it("requires at least one selected participant", () => {
    const organizerInitialVote = {
      userId: "organizer",
      restaurantId: "initial",
    } as const;

    expect(() =>
      policy()({
        selectedParticipantIds: [],
        initialRestaurantId: "initial",
        organizerInitialVote,
        votes: [],
      }),
    ).toThrow("At least one selected participant is required.");
  });

  it("requires selected participant IDs to be unique", () => {
    const organizerInitialVote = {
      userId: "organizer",
      restaurantId: "initial",
    } as const;

    expect(() =>
      policy()({
        selectedParticipantIds: ["organizer", "organizer"],
        initialRestaurantId: "initial",
        organizerInitialVote,
        votes: [],
      }),
    ).toThrow("Selected participant IDs must be unique.");
  });
});
