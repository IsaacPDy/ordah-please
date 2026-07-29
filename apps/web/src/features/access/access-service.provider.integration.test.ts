import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { and, count, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  type AuditEventsRepository,
  adminAccessRequests,
  auditEvents,
  createRepositories,
  type Database,
  type GroupAccessRepository,
  groups,
  type IdentityAccessRepository,
  invitations,
  memberships,
  withTransaction,
} from "@ordah-please/db";

import {
  acceptGroupInvitation,
  manageGroupMember,
  submitAdminAccessRequest,
} from "./access-service";

const migrationDirectory = fileURLToPath(
  new URL("../../../../../packages/db/drizzle/", import.meta.url),
);

type AccessRepositories = Readonly<{
  access: GroupAccessRepository &
    Pick<IdentityAccessRepository, "addMembership" | "listActiveMemberships">;
  auditEvents: AuditEventsRepository;
}>;

let adminPool: Pool;
let database: Database;
let runtimePool: Pool;
let schemaCreated = false;
let testSchema = "";

/** Restricts and quotes the temporary schema identifier before it reaches SQL. */
function quoteTestSchema(identifier: string): string {
  if (!/^[a-z0-9_]+$/u.test(identifier)) {
    throw new TypeError("Test schema name contains unsupported characters.");
  }
  return `"${identifier}"`;
}

/** Enables full certificate verification without changing the stored credential. */
function secureConnectionString(connectionString: string): string {
  const connectionUrl = new URL(connectionString);
  connectionUrl.searchParams.set("sslmode", "verify-full");
  return connectionUrl.toString();
}

/** Binds every pooled connection to the temporary schema so concurrency stays isolated. */
function schemaConnectionString(
  connectionString: string,
  schemaName: string,
): string {
  const connectionUrl = new URL(secureConnectionString(connectionString));
  connectionUrl.searchParams.set("options", `-c search_path=${schemaName}`);
  return connectionUrl.toString();
}

/** Loads generated migrations and redirects explicit public references to the test schema. */
async function readMigrationStatements(schemaName: string): Promise<string[]> {
  const fileNames = (await readdir(migrationDirectory))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const quotedSchema = quoteTestSchema(schemaName);
  const statements: string[] = [];

  for (const fileName of fileNames) {
    const migration = await readFile(
      new URL(
        `../../../../../packages/db/drizzle/${fileName}`,
        import.meta.url,
      ),
      "utf8",
    );
    statements.push(
      ...migration
        .replaceAll('"public".', `${quotedSchema}.`)
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim())
        .filter((statement) => statement !== ""),
    );
  }
  return statements;
}

/** Composes the same access transaction boundary used by production route handlers. */
function createAccessTransactionRunner(failAudit = false): {
  run<Result>(
    operation: (repositories: AccessRepositories) => Promise<Result>,
  ): Promise<Result>;
} {
  return {
    run: (operation) =>
      withTransaction(database, (transaction) => {
        const repositories = createRepositories(transaction);
        return operation({
          access: {
            ...repositories.groupAccess,
            addMembership: (input) =>
              repositories.identityAccess.addMembership(input),
            listActiveMemberships: (userId) =>
              repositories.identityAccess.listActiveMemberships(userId),
          },
          auditEvents: failAudit
            ? {
                ...repositories.auditEvents,
                append: () => Promise.reject(new Error("forced-audit-failure")),
              }
            : repositories.auditEvents,
        });
      }),
  };
}

/** Creates one product user without assigning provider or product roles. */
async function createTestUser(displayName: string): Promise<string> {
  const user = await createRepositories(database).identityAccess.createUser({
    displayName,
  });
  return user.id;
}

/** Creates one group and its owner membership for live access-service tests. */
async function createOwnedGroup(
  ownerUserId: string,
  name: string,
): Promise<string> {
  const [group] = await database
    .insert(groups)
    .values({ createdByUserId: ownerUserId, name })
    .returning();
  if (group === undefined) {
    throw new Error("Expected the provider test group to be created.");
  }
  await createRepositories(database).identityAccess.addMembership({
    groupId: group.id,
    role: "owner",
    userId: ownerUserId,
  });
  return group.id;
}

/** Creates one future invitation with a caller-controlled persistence hash. */
async function createTestInvitation(
  groupId: string,
  ownerUserId: string,
  tokenHash: string,
): Promise<string> {
  const invitation = await createRepositories(
    database,
  ).groupAccess.createInvitation({
    createdByUserId: ownerUserId,
    expiresAt: new Date("2026-08-01T00:00:00.000Z"),
    groupId,
    tokenHash,
  });
  return invitation.id;
}

beforeAll(async () => {
  const directConnectionString = process.env.DATABASE_MIGRATION_URL;
  if (
    directConnectionString === undefined ||
    directConnectionString.trim() === ""
  ) {
    throw new Error(
      "DATABASE_MIGRATION_URL is required for concurrent access provider tests.",
    );
  }

  testSchema = `access_service_test_${randomUUID().replaceAll("-", "")}`;
  adminPool = new Pool({
    connectionString: secureConnectionString(directConnectionString),
    max: 1,
  });
  await adminPool.query(`CREATE SCHEMA ${quoteTestSchema(testSchema)}`);
  schemaCreated = true;
  await adminPool.query(`SET search_path TO ${quoteTestSchema(testSchema)}`);
  for (const statement of await readMigrationStatements(testSchema)) {
    await adminPool.query(statement);
  }

  runtimePool = new Pool({
    connectionString: schemaConnectionString(
      directConnectionString,
      testSchema,
    ),
    max: 4,
  });
  database = drizzle(runtimePool, {
    schema: await import("@ordah-please/db"),
  });
}, 30_000);

afterAll(async () => {
  await runtimePool?.end();
  if (adminPool === undefined) {
    return;
  }
  if (schemaCreated) {
    await adminPool.query("SET search_path TO public");
    await adminPool.query(`DROP SCHEMA ${quoteTestSchema(testSchema)} CASCADE`);
  }
  await adminPool.end();
});

describe("access service provider transactions", () => {
  it("rolls back invitation consumption and membership when the audit append fails", async () => {
    const ownerUserId = await createTestUser("Rollback Owner");
    const memberUserId = await createTestUser("Rollback Member");
    const groupId = await createOwnedGroup(ownerUserId, "Rollback Group");
    const tokenHash = randomUUID().replaceAll("-", "");
    const invitationId = await createTestInvitation(
      groupId,
      ownerUserId,
      tokenHash,
    );

    await expect(
      acceptGroupInvitation(
        {
          deploymentId: "provider.test",
          now: new Date("2026-07-29T12:00:00.000Z"),
          publicToken: "public-token",
          userId: memberUserId,
        },
        createAccessTransactionRunner(true),
        () => tokenHash,
      ),
    ).rejects.toThrow("forced-audit-failure");

    await expect(
      database
        .select()
        .from(invitations)
        .where(eq(invitations.id, invitationId)),
    ).resolves.toMatchObject([{ acceptedAt: null, acceptedByUserId: null }]);
    await expect(
      createRepositories(database).identityAccess.listActiveMemberships(
        memberUserId,
      ),
    ).resolves.toHaveLength(0);
  });

  it("allows one competing invitation, rolls the loser back, and permits a later rejoin", async () => {
    const firstOwnerId = await createTestUser("First Owner");
    const secondOwnerId = await createTestUser("Second Owner");
    const memberUserId = await createTestUser("Competing Member");
    const firstGroupId = await createOwnedGroup(firstOwnerId, "First Group");
    const secondGroupId = await createOwnedGroup(secondOwnerId, "Second Group");
    const firstHash = randomUUID().replaceAll("-", "");
    const secondHash = randomUUID().replaceAll("-", "");
    await createTestInvitation(firstGroupId, firstOwnerId, firstHash);
    await createTestInvitation(secondGroupId, secondOwnerId, secondHash);

    const competing = await Promise.allSettled([
      acceptGroupInvitation(
        {
          deploymentId: "provider.test",
          now: new Date("2026-07-29T12:10:00.000Z"),
          publicToken: "first-token",
          userId: memberUserId,
        },
        createAccessTransactionRunner(),
        () => firstHash,
      ),
      acceptGroupInvitation(
        {
          deploymentId: "provider.test",
          now: new Date("2026-07-29T12:10:00.000Z"),
          publicToken: "second-token",
          userId: memberUserId,
        },
        createAccessTransactionRunner(),
        () => secondHash,
      ),
    ]);

    expect(
      competing.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      competing.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    const [activeMembership] =
      await createRepositories(database).identityAccess.listActiveMemberships(
        memberUserId,
      );
    if (activeMembership === undefined) {
      throw new Error("Expected one competing membership to commit.");
    }

    await expect(
      createRepositories(database).groupAccess.removeMembership(
        activeMembership.groupId,
        memberUserId,
        new Date("2026-07-29T12:20:00.000Z"),
      ),
    ).resolves.toBe(true);
    const rejoinHash = randomUUID().replaceAll("-", "");
    await createTestInvitation(
      activeMembership.groupId,
      activeMembership.groupId === firstGroupId ? firstOwnerId : secondOwnerId,
      rejoinHash,
    );
    await expect(
      acceptGroupInvitation(
        {
          deploymentId: "provider.test",
          now: new Date("2026-07-29T12:30:00.000Z"),
          publicToken: "rejoin-token",
          userId: memberUserId,
        },
        createAccessTransactionRunner(),
        () => rejoinHash,
      ),
    ).resolves.toMatchObject({
      groupId: activeMembership.groupId,
      role: "member",
    });
  });

  it("commits only one duplicate role action and one concurrent admin request", async () => {
    const ownerUserId = await createTestUser("Concurrency Owner");
    const memberUserId = await createTestUser("Concurrency Member");
    const groupId = await createOwnedGroup(ownerUserId, "Concurrency Group");
    await createRepositories(database).identityAccess.addMembership({
      groupId,
      role: "member",
      userId: memberUserId,
    });

    const promotions = await Promise.allSettled([
      manageGroupMember(
        {
          action: "promote",
          actorUserId: ownerUserId,
          groupId,
          now: new Date("2026-07-29T13:00:00.000Z"),
          targetUserId: memberUserId,
        },
        createAccessTransactionRunner(),
      ),
      manageGroupMember(
        {
          action: "promote",
          actorUserId: ownerUserId,
          groupId,
          now: new Date("2026-07-29T13:00:00.000Z"),
          targetUserId: memberUserId,
        },
        createAccessTransactionRunner(),
      ),
    ]);
    expect(
      promotions.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      promotions.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);

    const adminRequests = await Promise.allSettled([
      submitAdminAccessRequest(
        { actorUserId: ownerUserId, groupId },
        createAccessTransactionRunner(),
      ),
      submitAdminAccessRequest(
        { actorUserId: ownerUserId, groupId },
        createAccessTransactionRunner(),
      ),
    ]);
    expect(
      adminRequests.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      adminRequests.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);

    const [promotionAudit] = await database
      .select({ value: count() })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.action, "group.member_promoted"),
          eq(auditEvents.resourceId, memberUserId),
        ),
      );
    const [pendingRequest] = await database
      .select({ value: count() })
      .from(adminAccessRequests)
      .where(
        and(
          eq(adminAccessRequests.requesterUserId, ownerUserId),
          eq(adminAccessRequests.status, "pending"),
        ),
      );
    if (promotionAudit === undefined || pendingRequest === undefined) {
      throw new Error("Expected provider test aggregate rows.");
    }

    expect(promotionAudit.value).toBe(1);
    expect(pendingRequest.value).toBe(1);
    await expect(
      database
        .select()
        .from(memberships)
        .where(
          and(
            eq(memberships.groupId, groupId),
            eq(memberships.userId, memberUserId),
            isNull(memberships.removedAt),
          ),
        ),
    ).resolves.toMatchObject([{ role: "organizer" }]);
  });
});
