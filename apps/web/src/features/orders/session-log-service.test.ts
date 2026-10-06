import { describe, expect, it, vi } from "vitest";
import { parseId, type GroupId, type UserId } from "@ordah-please/domain";
/* eslint-disable @typescript-eslint/require-await */
import type { AppIdentity } from "../../auth/load-app-identity";
import {
  deleteGroupPermanently,
  deleteSessionLog,
  mutateSessionLog,
  parseSessionLogRequest,
} from "./session-log-service";
const groupId = parseId<GroupId>("aaaaaaaa-0000-4000-8000-000000000001");
const userId = parseId<UserId>("bbbbbbbb-0000-4000-8000-000000000001");
const identity: AppIdentity = {
  userId,
  authUserId: "auth",
  displayName: "Owner",
  email: "owner@example.test",
  imageUrl: null,
  isPlatformAdmin: false,
  memberships: [{ groupId, role: "group-owner" }],
};
const request = {
  groupId,
  state: "draft",
  restaurantId: null,
  createdAt: "2026-10-06T04:00:00Z",
  deliveryAddress: null,
  participants: [
    { userId, displayName: "Owner", foodResponse: "pending", lines: [] },
  ],
};
function fixture() {
  const log = {
    lockGroup: vi.fn(async () => ({ archivedAt: null })),
    lockOrder: vi.fn(async () => ({ groupId, participantIds: [userId] })),
    save: vi.fn(async () => ({ id: "cccccccc-0000-4000-8000-000000000001" })),
    deleteOrder: vi.fn(async () => true),
    deleteGroup: vi.fn(async () => true),
  };
  const repositories = {
    sessionLogs: log,
    groupAccess: {
      listActiveMembers: vi.fn(async () => [
        { userId, displayName: "Owner", role: "owner" as const },
      ]),
    },
    catalog: {
      getRestaurantDetail: vi.fn(),
      findPublishedMenuVersion: vi.fn(),
    },
    auditEvents: { append: vi.fn() },
    identityAccess: {
      findUserById: vi.fn(async () => ({
        isPlatformAdmin: true,
        archivedAt: null,
      })),
    },
  };
  const runner = {
    run: async <T>(operation: (r: typeof repositories) => Promise<T>) =>
      operation(repositories),
  };
  return { log, repositories, runner };
}
describe("editable session logs", () => {
  it("saves participants without a restaurant or address", async () => {
    const f = fixture();
    await mutateSessionLog(
      {
        identity,
        request: parseSessionLogRequest(request),
        now: new Date("2026-10-06T05:00:00Z"),
      },
      f.runner,
    );
    expect(f.log.save).toHaveBeenCalled();
    const call = f.log.save.mock.calls[0];
    expect(call).toBeDefined();
    expect(f.repositories.catalog.getRestaurantDetail).not.toHaveBeenCalled();
  });
  it("lets an owner finish an existing log without a restaurant", async () => {
    const f = fixture();
    await mutateSessionLog(
      {
        identity,
        orderId: "order",
        request: parseSessionLogRequest({ ...request, state: "ordered" }),
        now: new Date("2026-10-06T05:00:00Z"),
      },
      f.runner,
    );
    expect(f.log.save).toHaveBeenCalled();
  });
  it("rejects manager edits to existing history and member creation", async () => {
    for (const role of ["manager", "member"] as const) {
      const f = fixture();
      await expect(
        mutateSessionLog(
          {
            identity: { ...identity, memberships: [{ groupId, role }] },
            orderId: "order",
            request: parseSessionLogRequest(request),
            now: new Date("2026-10-06T05:00:00Z"),
          },
          f.runner,
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(f.log.save).not.toHaveBeenCalled();
    }
  });
  it("rejects participants outside the group", async () => {
    const f = fixture();
    f.repositories.groupAccess.listActiveMembers.mockResolvedValue([]);
    await expect(
      mutateSessionLog(
        {
          identity,
          request: parseSessionLogRequest(request),
          now: new Date("2026-10-06T05:00:00Z"),
        },
        f.runner,
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
  it("allows only group owners to delete sessions", async () => {
    const f = fixture();
    await deleteSessionLog({ identity, orderId: "order" }, f.runner);
    expect(f.log.deleteOrder).toHaveBeenCalledWith("order");
    const other = fixture();
    await expect(
      deleteSessionLog(
        {
          identity: { ...identity, isPlatformAdmin: true, memberships: [] },
          orderId: "order",
        },
        other.runner,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(other.log.deleteOrder).not.toHaveBeenCalled();
  });
  it("allows admins to permanently delete archived groups and refuses other users", async () => {
    const f = fixture();
    await deleteGroupPermanently({ identity, groupId }, f.runner);
    expect(f.log.deleteGroup).toHaveBeenCalledWith(groupId);
    const other = fixture();
    other.repositories.identityAccess.findUserById.mockResolvedValue({
      isPlatformAdmin: false,
      archivedAt: null,
    });
    await expect(
      deleteGroupPermanently({ identity, groupId }, other.runner),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(other.log.deleteGroup).not.toHaveBeenCalled();
  });
  it("rejects changing an existing session to another group", async () => {
    const f = fixture();
    f.log.lockOrder.mockResolvedValue({
      groupId: parseId<GroupId>("dddddddd-0000-4000-8000-000000000001"),
      participantIds: [userId],
    });
    await expect(
      mutateSessionLog(
        {
          identity,
          orderId: "order",
          request: parseSessionLogRequest(request),
          now: new Date("2026-10-06T05:00:00Z"),
        },
        f.runner,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(f.log.save).not.toHaveBeenCalled();
  });
  it("recalculates line totals and rejects unsafe quantities and duplicate participants", () => {
    const withLine = {
      ...request,
      participants: [
        {
          ...request.participants[0],
          foodResponse: "confirmed",
          lines: [
            {
              itemName: "Rice",
              quantity: 2,
              unitPriceCentavos: 1250,
              note: "",
            },
          ],
        },
      ],
    };
    expect(
      parseSessionLogRequest(withLine).participants[0]?.lines[0]
        ?.lineSubtotalCentavos,
    ).toBe(2500);
    expect(() =>
      parseSessionLogRequest({
        ...withLine,
        participants: [
          {
            ...withLine.participants[0],
            lines: [
              {
                itemName: "Rice",
                quantity: 0,
                unitPriceCentavos: 1250,
                note: "",
              },
            ],
          },
        ],
      }),
    ).toThrow();
    expect(() =>
      parseSessionLogRequest({
        ...request,
        participants: [request.participants[0], request.participants[0]],
      }),
    ).toThrow();
  });
});
