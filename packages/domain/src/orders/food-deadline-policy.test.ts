import { describe, expect, it } from "vitest";

import * as domain from "../index.js";

const rankOneSelection = {
  source: { kind: "saved_favorite", favoriteId: "favorite-1" },
  items: [
    {
      menuItemId: "item-1",
      name: "Meal",
      quantity: 1,
      unitPriceCentavos: 10000,
      variant: null,
      modifiers: [],
      note: "",
    },
  ],
} as const;

type Selection = Readonly<{
  source:
    | Readonly<{ kind: "saved_favorite"; favoriteId: string }>
    | Readonly<{ kind: "inline" }>;
  items: typeof rankOneSelection.items;
}>;

type ResolveDeadline = (input: {
  participants: readonly {
    userId: string;
    rankOneSelection: Selection | null;
    rankOneAvailable: boolean;
  }[];
  responses: readonly (
    | { kind: "confirmed"; userId: string; selection: Selection }
    | { kind: "declined"; userId: string }
  )[];
}) => {
  selections: readonly { userId: string; selection: Selection }[];
  declinedUserIds: readonly string[];
  unresolvedUserIds: readonly string[];
};

/** Loads the planned policy while keeping the first RED run executable. */
function policy(): ResolveDeadline {
  const candidate: unknown =
    "resolveFoodDeadline" in domain ? domain.resolveFoodDeadline : undefined;
  expect(candidate).toBeTypeOf("function");
  return candidate as ResolveDeadline;
}

describe("resolveFoodDeadline", () => {
  it("applies valid Rank 1 to a non-responder", () => {
    expect(
      policy()({
        participants: [
          { userId: "user-1", rankOneSelection, rankOneAvailable: true },
        ],
        responses: [],
      }),
    ).toEqual({
      selections: [{ userId: "user-1", selection: rankOneSelection }],
      declinedUserIds: [],
      unresolvedUserIds: [],
    });
  });

  it("keeps explicit replacement and decline decisions", () => {
    const replacement = {
      ...rankOneSelection,
      source: { kind: "inline" as const },
    };

    expect(
      policy()({
        participants: [
          { userId: "user-1", rankOneSelection, rankOneAvailable: true },
          { userId: "user-2", rankOneSelection, rankOneAvailable: true },
        ],
        responses: [
          { kind: "confirmed", userId: "user-1", selection: replacement },
          { kind: "declined", userId: "user-2" },
        ],
      }),
    ).toEqual({
      selections: [{ userId: "user-1", selection: replacement }],
      declinedUserIds: ["user-2"],
      unresolvedUserIds: [],
    });
  });

  it("requires manager resolution for unavailable or missing Rank 1", () => {
    expect(
      policy()({
        participants: [
          { userId: "user-1", rankOneSelection, rankOneAvailable: false },
          { userId: "user-2", rankOneSelection: null, rankOneAvailable: false },
        ],
        responses: [],
      }),
    ).toEqual({
      selections: [],
      declinedUserIds: [],
      unresolvedUserIds: ["user-1", "user-2"],
    });
  });
});
