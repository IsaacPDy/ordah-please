import type { UserId } from "../types/ids.js";
import type { FoodSelectionSnapshot } from "./order.js";

export type FoodDeadlineParticipant = Readonly<{
  userId: UserId;
  rankOneSelection: FoodSelectionSnapshot | null;
  rankOneAvailable: boolean;
}>;

export type FoodDeadlineResponse =
  | Readonly<{
      kind: "confirmed";
      userId: UserId;
      selection: FoodSelectionSnapshot;
    }>
  | Readonly<{ kind: "declined"; userId: UserId }>;

export type FoodDeadlineResolution = Readonly<{
  selections: readonly Readonly<{
    userId: UserId;
    selection: FoodSelectionSnapshot;
  }>[];
  declinedUserIds: readonly UserId[];
  unresolvedUserIds: readonly UserId[];
}>;

/** Applies explicit food responses, then Rank 1 defaults, and lists Manager work. */
export function resolveFoodDeadline(input: {
  participants: readonly FoodDeadlineParticipant[];
  responses: readonly FoodDeadlineResponse[];
}): FoodDeadlineResolution {
  const responsesByUser = new Map<UserId, FoodDeadlineResponse>();

  for (const response of input.responses) {
    if (responsesByUser.has(response.userId)) {
      throw new Error(
        `Participant ${response.userId} has more than one food response.`,
      );
    }
    responsesByUser.set(response.userId, response);
  }

  const selections: Array<{
    userId: UserId;
    selection: FoodSelectionSnapshot;
  }> = [];
  const declinedUserIds: UserId[] = [];
  const unresolvedUserIds: UserId[] = [];

  for (const participant of input.participants) {
    const response = responsesByUser.get(participant.userId);

    if (response?.kind === "confirmed") {
      selections.push({
        userId: participant.userId,
        selection: response.selection,
      });
    } else if (response?.kind === "declined") {
      declinedUserIds.push(participant.userId);
    } else if (
      participant.rankOneAvailable &&
      participant.rankOneSelection !== null
    ) {
      selections.push({
        userId: participant.userId,
        selection: participant.rankOneSelection,
      });
    } else {
      unresolvedUserIds.push(participant.userId);
    }
  }

  return { selections, declinedUserIds, unresolvedUserIds };
}
