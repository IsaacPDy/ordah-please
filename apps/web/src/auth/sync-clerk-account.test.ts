import { describe, expect, it } from "vitest";

import { applyClerkAccountEvent, syncClerkAccount } from "./sync-clerk-account";

describe("applyClerkAccountEvent", () => {
  it("skips account mutation when the Clerk event was already audited", async () => {
    const repositories = {
      auditEvents: {
        appendOnce: () => Promise.resolve(undefined),
      },
      identityAccess: {
        archiveUserByClerkId: () => {
          throw new Error("duplicate event must not archive");
        },
        upsertUserFromClerk: () => {
          throw new Error("duplicate event must not upsert");
        },
      },
    };

    await expect(
      applyClerkAccountEvent(
        {
          clerkUserId: "user_clerk_123",
          displayName: "Avery Rivera",
          eventId: "evt_duplicate",
          occurredAt: new Date("2026-07-23T06:00:00.000Z"),
          type: "user.updated",
        },
        repositories,
      ),
    ).resolves.toEqual({ status: "duplicate" });
  });

  it("upserts a created or updated Clerk account after claiming the event", async () => {
    let upsertInput: unknown;
    const repositories = {
      auditEvents: {
        appendOnce: () => Promise.resolve({ id: "audit-1" }),
      },
      identityAccess: {
        archiveUserByClerkId: () => {
          throw new Error("upsert event must not archive");
        },
        upsertUserFromClerk: (input: unknown) => {
          upsertInput = input;
          return Promise.resolve({ id: "internal-user-1" });
        },
      },
    };

    await expect(
      applyClerkAccountEvent(
        {
          clerkUserId: "user_clerk_123",
          displayName: "Avery Rivera",
          eventId: "evt_created",
          occurredAt: new Date("2026-07-23T06:00:00.000Z"),
          type: "user.created",
        },
        repositories,
      ),
    ).resolves.toEqual({ status: "applied" });
    expect(upsertInput).toEqual({
      clerkUserId: "user_clerk_123",
      displayName: "Avery Rivera",
      updatedAt: new Date("2026-07-23T06:00:00.000Z"),
    });
  });

  it("archives a deleted Clerk account without removing its product history", async () => {
    let archiveInput: unknown;
    const repositories = {
      auditEvents: {
        appendOnce: () => Promise.resolve({ id: "audit-1" }),
      },
      identityAccess: {
        archiveUserByClerkId: (clerkUserId: string, occurredAt: Date) => {
          archiveInput = { clerkUserId, occurredAt };
          return Promise.resolve({ id: "internal-user-1" });
        },
        upsertUserFromClerk: () => {
          throw new Error("delete event must not upsert");
        },
      },
    };

    await expect(
      applyClerkAccountEvent(
        {
          clerkUserId: "user_clerk_123",
          eventId: "evt_deleted",
          occurredAt: new Date("2026-07-23T07:00:00.000Z"),
          type: "user.deleted",
        },
        repositories,
      ),
    ).resolves.toEqual({ status: "applied" });
    expect(archiveInput).toEqual({
      clerkUserId: "user_clerk_123",
      occurredAt: new Date("2026-07-23T07:00:00.000Z"),
    });
  });

  it("runs the audit claim and account mutation inside one transaction", async () => {
    let transactionRuns = 0;
    const repositories = {
      auditEvents: {
        appendOnce: () => Promise.resolve(undefined),
      },
      identityAccess: {
        archiveUserByClerkId: () => Promise.resolve(undefined),
        upsertUserFromClerk: () => Promise.resolve({ id: "internal-user-1" }),
      },
    };
    const transactionRunner = {
      run: async <Result>(
        operation: (value: typeof repositories) => Promise<Result>,
      ) => {
        transactionRuns += 1;
        return operation(repositories);
      },
    };

    await expect(
      syncClerkAccount(
        {
          clerkUserId: "user_clerk_123",
          displayName: "Avery Rivera",
          eventId: "evt_transaction",
          occurredAt: new Date("2026-07-23T06:00:00.000Z"),
          type: "user.updated",
        },
        transactionRunner,
      ),
    ).resolves.toEqual({ status: "duplicate" });
    expect(transactionRuns).toBe(1);
  });
});
