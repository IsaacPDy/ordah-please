import type { RestaurantId, UserId } from "../types/ids.js";

export type RestaurantVoteResolution = Readonly<{
  restaurantId: RestaurantId;
  reason: "threshold" | "initial_fallback" | "tie";
}>;

/** Resolves restaurant votes using the 50 percent threshold and initial-restaurant fallback. */
export function resolveRestaurantVote(input: {
  selectedParticipantIds: readonly UserId[];
  initialRestaurantId: RestaurantId;
  managerInitialVote: Readonly<{
    userId: UserId;
    restaurantId: RestaurantId;
  }>;
  votes: readonly Readonly<{
    userId: UserId;
    restaurantId: RestaurantId;
  }>[];
}): RestaurantVoteResolution {
  if (input.selectedParticipantIds.length === 0) {
    throw new RangeError("At least one selected participant is required.");
  }

  const selectedParticipants = new Set(input.selectedParticipantIds);
  if (selectedParticipants.size !== input.selectedParticipantIds.length) {
    throw new Error("Selected participant IDs must be unique.");
  }

  if (!selectedParticipants.has(input.managerInitialVote.userId)) {
    throw new Error("The manager must be a selected participant.");
  }

  if (input.managerInitialVote.restaurantId !== input.initialRestaurantId) {
    throw new Error(
      "The manager's initial vote must use the initial restaurant.",
    );
  }

  const submittedUsers = new Set<UserId>();
  const votesByUser = new Map<UserId, RestaurantId>([
    [input.managerInitialVote.userId, input.managerInitialVote.restaurantId],
  ]);

  for (const vote of input.votes) {
    if (!selectedParticipants.has(vote.userId)) {
      throw new Error("Only selected participants may vote.");
    }

    if (submittedUsers.has(vote.userId)) {
      throw new Error(
        `Participant ${vote.userId} submitted more than one vote.`,
      );
    }

    submittedUsers.add(vote.userId);
    votesByUser.set(vote.userId, vote.restaurantId);
  }

  const counts = new Map<RestaurantId, number>();
  for (const restaurantId of votesByUser.values()) {
    counts.set(restaurantId, (counts.get(restaurantId) ?? 0) + 1);
  }

  const threshold = Math.ceil(input.selectedParticipantIds.length / 2);
  const highestCount = Math.max(0, ...counts.values());
  const leaders = [...counts.entries()]
    .filter(([, count]) => count === highestCount)
    .map(([restaurantId]) => restaurantId);

  if (highestCount < threshold || leaders.length === 0) {
    return {
      restaurantId: input.initialRestaurantId,
      reason: "initial_fallback",
    };
  }

  if (leaders.length > 1) {
    return { restaurantId: input.initialRestaurantId, reason: "tie" };
  }

  const winner = leaders[0];
  if (winner === undefined) {
    throw new Error("Vote resolution did not produce a winner.");
  }

  return { restaurantId: winner, reason: "threshold" };
}
