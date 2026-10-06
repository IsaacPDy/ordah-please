import { parseDeliveryAddress, PublicApiError } from "@ordah-please/contracts";
import { parseId, type GroupId } from "@ordah-please/domain";
import type {
  SessionLogWrite,
  SessionLogsRepository,
  SessionRestaurant,
} from "@ordah-please/db";
import type { AppIdentity } from "../../auth/load-app-identity";
import { requireGroupRole } from "../../application/group-authorization";

const invalid = () =>
  new PublicApiError(
    "INVALID_INPUT",
    "Check the session details and try again.",
  );
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function sessionId(value: unknown): string {
  if (typeof value !== "string" || !uuid.test(value)) throw invalid();
  return value;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown, allowEmpty = false): string {
  if (
    typeof value !== "string" ||
    value.length > 2000 ||
    (!allowEmpty && !value.trim())
  )
    throw invalid();
  return value.trim();
}
function date(value: unknown): string {
  const parsed = text(value);
  if (!Number.isFinite(Date.parse(parsed))) throw invalid();
  return new Date(parsed).toISOString();
}
/** Strictly validates manual log snapshots; totals are always calculated by the server. */
export function parseSessionLogRequest(value: unknown): SessionLogWrite {
  const row = object(value);
  if (
    !Object.keys(row).every((key) =>
      [
        "groupId",
        "state",
        "restaurantId",
        "createdAt",
        "completedAt",
        "managerUserId",
        "deliveryAddress",
        "participants",
      ].includes(key),
    )
  )
    throw invalid();
  if (
    row.state !== "draft" &&
    row.state !== "ordered" &&
    row.state !== "cancelled"
  )
    throw invalid();
  if (
    !Array.isArray(row.participants) ||
    row.participants.length < 1 ||
    row.participants.length > 100
  )
    throw invalid();
  const seen = new Set<string>();
  let total = 0;
  const participants = row.participants.map((value) => {
    const person = object(value);
    const userId = sessionId(person.userId);
    if (seen.has(userId)) throw invalid();
    seen.add(userId);
    if (
      !["pending", "confirmed", "declined", "resolved"].includes(
        String(person.foodResponse),
      ) ||
      !Array.isArray(person.lines) ||
      person.lines.length > 100
    )
      throw invalid();
    const lines = person.lines.map((value) => {
      const line = object(value);
      const quantity = line.quantity;
      const price = line.unitPriceCentavos;
      if (
        typeof quantity !== "number" ||
        !Number.isSafeInteger(quantity) ||
        quantity < 1 ||
        typeof price !== "number" ||
        !Number.isSafeInteger(price) ||
        price < 0 ||
        !Number.isSafeInteger(quantity * price)
      )
        throw invalid();
      total += quantity * price;
      if (!Number.isSafeInteger(total)) throw invalid();
      return {
        ...(line.originalLineId
          ? { originalLineId: sessionId(line.originalLineId) }
          : {}),
        itemName: text(line.itemName),
        quantity,
        unitPriceCentavos: price,
        note: text(line.note, true),
        lineSubtotalCentavos: quantity * price,
      };
    });
    if (
      lines.length &&
      person.foodResponse !== "confirmed" &&
      person.foodResponse !== "resolved"
    )
      throw invalid();
    return {
      userId,
      displayName: text(person.displayName),
      foodResponse:
        person.foodResponse as SessionLogWrite["participants"][number]["foodResponse"],
      lines,
    };
  });
  const managerUserId =
    row.managerUserId === undefined
      ? participants[0]!.userId
      : sessionId(row.managerUserId);
  if (!seen.has(managerUserId)) throw invalid();
  const createdAt = date(row.createdAt);
  const completedAt = row.completedAt == null ? null : date(row.completedAt);
  if (completedAt && Date.parse(completedAt) < Date.parse(createdAt))
    throw invalid();
  return {
    groupId: sessionId(row.groupId),
    state: row.state,
    restaurantId:
      row.restaurantId === null ? null : sessionId(row.restaurantId),
    createdAt,
    completedAt,
    managerUserId,
    deliveryAddress:
      row.deliveryAddress === null
        ? null
        : { ...parseDeliveryAddress(row.deliveryAddress, "Delivery address") },
    participants,
  };
}
interface Repositories {
  sessionLogs: SessionLogsRepository;
  groupAccess: {
    listActiveMembers: (groupId: string) => Promise<
      readonly {
        userId: string;
        displayName: string;
        role: "owner" | "manager" | "member";
      }[]
    >;
  };
  catalog: {
    getRestaurantDetail: (id: string) => Promise<{
      branchId: string;
      branchName: string;
      restaurantName: string;
    } | null>;
    findPublishedMenuVersion: (
      id: string,
    ) => Promise<{ id: string } | undefined>;
  };
  identityAccess: {
    findUserById: (
      id: string,
    ) => Promise<
      { isPlatformAdmin: boolean; archivedAt: Date | null } | undefined
    >;
  };
  auditEvents: {
    append: (input: {
      actorUserId: string;
      action: string;
      resourceType: string;
      resourceId: string;
      details?: Record<string, unknown>;
    }) => Promise<unknown>;
  };
}
export interface SessionLogRunner {
  run<T>(operation: (repositories: Repositories) => Promise<T>): Promise<T>;
}
export async function mutateSessionLog(
  command: {
    identity: AppIdentity;
    request: SessionLogWrite;
    orderId?: string;
    now: Date;
  },
  runner: SessionLogRunner,
) {
  return runner.run(async (repositories) => {
    const request = command.request;
    if (
      request.state !== "draft" &&
      Date.parse(request.createdAt) >
        Date.parse(request.completedAt ?? command.now.toISOString())
    )
      throw new PublicApiError(
        "INVALID_INPUT",
        "Completion cannot be earlier than the session date.",
      );
    requireGroupRole(command.identity, parseId<GroupId>(request.groupId), [
      "group-owner",
      "manager",
    ]);
    const group = await repositories.sessionLogs.lockGroup(request.groupId);
    if (!group || group.archivedAt)
      throw new PublicApiError("NOT_FOUND", "Group not found.");
    let existingParticipantIds: readonly string[] = [];
    if (command.orderId) {
      const existing = await repositories.sessionLogs.lockOrder(
        command.orderId,
      );
      if (!existing)
        throw new PublicApiError("NOT_FOUND", "Session not found.");
      existingParticipantIds = existing.participantIds ?? [];
      if (existing.groupId !== request.groupId)
        throw new PublicApiError(
          "FORBIDDEN",
          "You do not have access to this action.",
        );
    }
    const members = await repositories.groupAccess.listActiveMembers(
      request.groupId,
    );
    const activeIds = new Set(members.map((member) => member.userId));
    // Saved snapshots for removed participants may remain; newly selected people must be current members.
    if (
      request.participants.some(
        (person) =>
          !activeIds.has(person.userId) &&
          !existingParticipantIds.includes(person.userId),
      )
    )
      throw new PublicApiError(
        "INVALID_INPUT",
        "Choose active members of this group.",
      );
    let restaurant: SessionRestaurant | null = null;
    if (request.restaurantId) {
      const detail = await repositories.catalog.getRestaurantDetail(
        request.restaurantId,
      );
      if (!detail)
        throw new PublicApiError("NOT_FOUND", "Restaurant not found.");
      const menu = await repositories.catalog.findPublishedMenuVersion(
        detail.branchId,
      );
      restaurant = {
        ...detail,
        restaurantId: request.restaurantId,
        menuVersionId: menu?.id ?? null,
      };
    }
    const saved = await repositories.sessionLogs.save({
      request,
      restaurant,
      now: command.now,
      ...(command.orderId ? { orderId: command.orderId } : {}),
    });
    await repositories.auditEvents.append({
      actorUserId: command.identity.userId,
      action: command.orderId ? "order.log_edited" : "order.logged",
      resourceType: "order",
      resourceId: saved.id,
    });
    return { orderId: saved.id };
  });
}
export async function deleteSessionLog(
  command: { identity: AppIdentity; orderId: string },
  runner: SessionLogRunner,
) {
  return runner.run(async (repositories) => {
    // Read for authorization, then lock group before order, matching group deletion lock order.
    const existing = await repositories.sessionLogs.lockOrder(command.orderId);
    if (!existing) throw new PublicApiError("NOT_FOUND", "Session not found.");
    requireGroupRole(command.identity, parseId<GroupId>(existing.groupId), [
      "group-owner",
      "manager",
    ]);
    await repositories.sessionLogs.deleteOrder(command.orderId);
    await repositories.auditEvents.append({
      actorUserId: command.identity.userId,
      action: "order.deleted",
      resourceType: "order",
      resourceId: command.orderId,
    });
    return { ok: true };
  });
}
export async function deleteGroupPermanently(
  command: { identity: AppIdentity; groupId: string },
  runner: SessionLogRunner,
) {
  return runner.run(async (repositories) => {
    const actor = await repositories.identityAccess.findUserById(
      command.identity.userId,
    );
    if (!actor?.isPlatformAdmin || actor.archivedAt)
      throw new PublicApiError("FORBIDDEN", "Access denied.");
    if (!(await repositories.sessionLogs.lockGroup(command.groupId)))
      throw new PublicApiError("NOT_FOUND", "Group not found.");
    await repositories.sessionLogs.deleteGroup(command.groupId);
    await repositories.auditEvents.append({
      actorUserId: command.identity.userId,
      action: "admin.delete_group",
      resourceType: "group",
      resourceId: command.groupId,
    });
    return { ok: true };
  });
}
