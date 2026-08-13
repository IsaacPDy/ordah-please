import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "../client.js";
import {
  authUsers,
  branches,
  catalogImports,
  favorites,
  groups,
  menuVersions,
  orders,
  restaurants,
  users,
} from "../schema/index.js";
import * as schema from "../schema/index.js";
import { withTransaction, type DatabaseTransaction } from "../transaction.js";
import { createRepositories, type Repositories } from "./index.js";

const migrationDirectory = fileURLToPath(
  new URL("../../drizzle/", import.meta.url),
);

let database: Database;
let pool: Pool;
let schemaCreated = false;
let testSchema = "";

/** Restricts and quotes the temporary schema identifier before it reaches SQL. */
function quoteTestSchema(identifier: string): string {
  if (!/^[a-z0-9_]+$/u.test(identifier)) {
    throw new TypeError("Test schema name contains unsupported characters.");
  }

  return `"${identifier}"`;
}

/** Enables full certificate verification without changing the stored pooled credential. */
function secureConnectionString(connectionString: string): string {
  const connectionUrl = new URL(connectionString);
  connectionUrl.searchParams.set("sslmode", "verify-full");
  return connectionUrl.toString();
}

/** Loads generated migration statements and redirects explicit public references to the temporary schema. */
async function readMigrationStatements(schemaName: string): Promise<string[]> {
  const fileNames = (await readdir(migrationDirectory))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const quotedSchema = quoteTestSchema(schemaName);
  const statements: string[] = [];

  for (const fileName of fileNames) {
    const migration = await readFile(
      new URL(`../../drizzle/${fileName}`, import.meta.url),
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

beforeAll(async () => {
  const connectionString = process.env.DATABASE_MIGRATION_URL;
  if (connectionString === undefined || connectionString.trim() === "") {
    throw new Error(
      "DATABASE_MIGRATION_URL is required for repository provider tests.",
    );
  }

  testSchema = `repository_test_${randomUUID().replaceAll("-", "")}`;
  pool = new Pool({
    connectionString: secureConnectionString(connectionString),
    max: 1,
  });
  const quotedSchema = quoteTestSchema(testSchema);
  await pool.query(`CREATE SCHEMA ${quotedSchema}`);
  schemaCreated = true;
  await pool.query(`SET search_path TO ${quotedSchema}`);

  for (const statement of await readMigrationStatements(testSchema)) {
    await pool.query(statement);
  }

  database = drizzle(pool, { schema });
}, 30_000);

afterAll(async () => {
  if (pool === undefined) {
    return;
  }

  if (schemaCreated) {
    await pool.query("SET search_path TO public");
    await pool.query(`DROP SCHEMA ${quoteTestSchema(testSchema)} CASCADE`);
  }
  await pool.end();
});

describe("focused repositories", () => {
  it("persists and reads each owned record shape without applying workflow policy", async () => {
    const repositories = createRepositories(database);
    const authUserId = randomUUID();
    await database.insert(authUsers).values({
      email: `repository-${authUserId}@example.test`,
      emailVerified: true,
      id: authUserId,
      name: "Repository User",
    });
    const user = await repositories.identityAccess.ensureUserForAuthIdentity({
      authUserId,
      displayName: "Repository User",
      email: "repository-user@example.test",
      imageUrl: null,
    });
    expect(
      await repositories.identityAccess.findUserByAuthUserId(authUserId),
    ).toMatchObject({ id: user.id, displayName: "Repository User" });

    const [group] = await database
      .insert(groups)
      .values({ createdByUserId: user.id, name: "Repository Group" })
      .returning();
    if (group === undefined) {
      throw new Error("Expected the repository test group to be created.");
    }

    await repositories.identityAccess.addMembership({
      groupId: group.id,
      role: "owner",
      userId: user.id,
    });

    const [secondGroup] = await database
      .insert(groups)
      .values({ createdByUserId: user.id, name: "Second Repository Group" })
      .returning();
    if (secondGroup === undefined) {
      throw new Error(
        "Expected the second repository test group to be created.",
      );
    }
    await repositories.identityAccess.addMembership({
      groupId: secondGroup.id,
      role: "manager",
      userId: user.id,
    });
    expect(
      await repositories.identityAccess.listActiveMemberships(user.id),
    ).toMatchObject(
      [group.id, secondGroup.id]
        .sort((left, right) => left.localeCompare(right))
        .map((groupId) => ({ groupId })),
    );

    const [restaurant] = await database
      .insert(restaurants)
      .values({ name: "Repository Restaurant" })
      .returning();
    if (restaurant === undefined) {
      throw new Error("Expected the repository test restaurant to be created.");
    }
    const [branch] = await database
      .insert(branches)
      .values({ name: "Main Branch", restaurantId: restaurant.id })
      .returning();
    if (branch === undefined) {
      throw new Error("Expected the repository test branch to be created.");
    }
    const [catalogImport] = await database
      .insert(catalogImports)
      .values({ createdByUserId: user.id, status: "published" })
      .returning();
    if (catalogImport === undefined) {
      throw new Error("Expected the repository test import to be created.");
    }
    const [menuVersion] = await database
      .insert(menuVersions)
      .values({
        branchId: branch.id,
        sourceImportId: catalogImport.id,
        status: "published",
        versionNumber: 1,
      })
      .returning();
    if (menuVersion === undefined) {
      throw new Error("Expected the repository test menu to be created.");
    }
    expect(
      await repositories.catalog.findPublishedMenuVersion(branch.id),
    ).toMatchObject({ id: menuVersion.id, status: "published" });

    await database.insert(favorites).values({
      branchId: branch.id,
      menuVersionId: menuVersion.id,
      name: "Rank One",
      rank: 1,
      userId: user.id,
    });
    expect(
      await repositories.favorites.listForUserAndBranch(user.id, branch.id),
    ).toMatchObject([{ name: "Rank One", rank: 1 }]);

    const [order] = await database
      .insert(orders)
      .values({
        choiceMode: "shortlist",
        deliveryAddressSnapshot: { city: "Manila", line1: "Example" },
        foodDeadline: new Date("2026-07-24T12:00:00.000Z"),
        groupId: group.id,
        initialBranchId: branch.id,
        initialRestaurantId: restaurant.id,
        managerUserId: user.id,
        restaurantDeadline: new Date("2026-07-24T11:00:00.000Z"),
      })
      .returning();
    if (order === undefined) {
      throw new Error("Expected the repository test order to be created.");
    }
    expect(await repositories.orders.findById(order.id)).toMatchObject({
      id: order.id,
      state: "draft",
    });

    const file = await repositories.files.create({
      contentType: "application/json",
      objectKey: `imports/${randomUUID()}.json`,
      ownerUserId: user.id,
      purpose: "import_source",
      sizeBytes: 128,
    });
    expect(file.status).toBe("pending");

    const notification = await repositories.notifications.create({
      eventType: "order.created",
      orderId: order.id,
      recipientUserId: user.id,
    });
    expect(notification.status).toBe("pending");

    const idempotencyKey = `order-created:${order.id}`;
    await repositories.jobs.create({
      idempotencyKey,
      kind: "order.created",
      orderId: order.id,
      scheduledFor: new Date("2026-07-24T10:00:00.000Z"),
    });
    expect(
      await repositories.jobs.findByIdempotencyKey(idempotencyKey),
    ).toMatchObject({ idempotencyKey, status: "pending" });

    await repositories.auditEvents.append({
      action: "order.created",
      actorUserId: user.id,
      resourceId: order.id,
      resourceType: "order",
    });
    expect(
      await repositories.auditEvents.listForResource("order", order.id),
    ).toHaveLength(1);
  });

  it("imports one catalog record per upload and replaces by source id after a rename", async () => {
    const repositories = createRepositories(database);
    const user = await repositories.identityAccess.createUser({
      displayName: "Catalog Import Admin",
    });
    const importCountBefore = (await database.select().from(catalogImports))
      .length;
    const firstRows = [
      {
        branchName: "Main",
        categoryName: "Meals",
        collectedAt: "2026-08-12",
        cuisines: ["Fast Food"],
        description: null,
        imageUrl: null,
        isAvailable: true,
        itemName: "Meal One",
        priceCentavos: 10000,
        restaurantName: "Original Restaurant",
        sourceRestaurantId: `source-${randomUUID()}`,
        sourceUrl: "https://food.grab.com/example-one",
      },
      {
        branchName: "Second",
        categoryName: "Meals",
        collectedAt: "2026-08-12",
        cuisines: ["Chicken"],
        description: "Chicken meal",
        imageUrl: null,
        isAvailable: true,
        itemName: "Meal Two",
        priceCentavos: 12000,
        restaurantName: "Second Restaurant",
        sourceRestaurantId: `source-${randomUUID()}`,
        sourceUrl: "https://food.grab.com/example-two",
      },
    ] as const;

    const first = await repositories.catalog.importCatalog(
      user.id,
      "first-catalog.csv",
      firstRows,
      [{ reason: "Skipped bad row", row: 4 }],
    );
    const renamedRows = [
      {
        ...firstRows[0],
        restaurantName: "Renamed Restaurant",
      },
    ];
    const second = await repositories.catalog.importCatalog(
      user.id,
      "renamed-catalog.csv",
      renamedRows,
      [],
    );

    expect(first).toMatchObject({
      itemsSkipped: 1,
      restaurantsAdded: 2,
      restaurantsUpdated: 0,
    });
    expect(second).toMatchObject({
      restaurantsAdded: 0,
      restaurantsUpdated: 1,
    });
    await expect(database.select().from(catalogImports)).resolves.toHaveLength(
      importCountBefore + 2,
    );
    await expect(
      database
        .select({ name: restaurants.name })
        .from(branches)
        .innerJoin(restaurants, eq(restaurants.id, branches.restaurantId))
        .where(eq(branches.sourceKey, firstRows[0].sourceRestaurantId)),
    ).resolves.toEqual([{ name: "Renamed Restaurant" }]);
    await expect(repositories.catalog.listRecentImports()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          restaurantCount: 1,
          sourceFileName: "renamed-catalog.csv",
          status: "published",
        }),
        expect.objectContaining({
          restaurantCount: 2,
          sourceFileName: "first-catalog.csv",
          status: "published",
        }),
      ]),
    );
  });

  it("commits an order change and audit together and rolls both back on failure", async () => {
    const repositories = createRepositories(database);
    const user = await repositories.identityAccess.createUser({
      displayName: "Transaction User",
    });
    const [group] = await database
      .insert(groups)
      .values({ createdByUserId: user.id, name: "Transaction Group" })
      .returning();
    const [restaurant] = await database
      .insert(restaurants)
      .values({ name: "Transaction Restaurant" })
      .returning();
    if (group === undefined || restaurant === undefined) {
      throw new Error("Expected transaction prerequisites to be created.");
    }
    const [branch] = await database
      .insert(branches)
      .values({ name: "Transaction Branch", restaurantId: restaurant.id })
      .returning();
    if (branch === undefined) {
      throw new Error("Expected the transaction branch to be created.");
    }
    const [order] = await database
      .insert(orders)
      .values({
        choiceMode: "shortlist",
        deliveryAddressSnapshot: { city: "Manila", line1: "Example" },
        foodDeadline: new Date("2026-07-25T12:00:00.000Z"),
        groupId: group.id,
        initialBranchId: branch.id,
        initialRestaurantId: restaurant.id,
        managerUserId: user.id,
        restaurantDeadline: new Date("2026-07-25T11:00:00.000Z"),
      })
      .returning();
    if (order === undefined) {
      throw new Error("Expected the transaction order to be created.");
    }

    await withTransaction(database, async (transaction) => {
      const transactional = createRepositories(transaction);
      await transactional.orders.setState(order.id, {
        completedAt: null,
        state: "restaurant_voting",
        updatedAt: new Date("2026-07-23T10:00:00.000Z"),
      });
      await transactional.auditEvents.append({
        action: "order.restaurant_voting_started",
        actorUserId: user.id,
        resourceId: order.id,
        resourceType: "order",
      });
    });

    await expect(
      withTransaction(database, async (transaction) => {
        const transactional = createRepositories(transaction);
        await transactional.orders.setState(order.id, {
          completedAt: null,
          state: "food_confirmation",
          updatedAt: new Date("2026-07-23T10:05:00.000Z"),
        });
        await transactional.auditEvents.append({
          action: "order.food_confirmation_started",
          actorUserId: user.id,
          resourceId: order.id,
          resourceType: "order",
        });
        throw new Error("force rollback");
      }),
    ).rejects.toThrowError("force rollback");

    expect(await repositories.orders.findById(order.id)).toMatchObject({
      state: "restaurant_voting",
    });
    expect(
      await repositories.auditEvents.listForResource("order", order.id),
    ).toMatchObject([{ action: "order.restaurant_voting_started" }]);
  });

  it("reuses one product user under concurrent first authenticated requests", async () => {
    const repositories = createRepositories(database);
    const authUserId = randomUUID();
    await database.insert(authUsers).values({
      email: `concurrent-${authUserId}@example.test`,
      emailVerified: true,
      id: authUserId,
      name: "Concurrent member",
    });
    const provisionedUsers = await Promise.all(
      Array.from({ length: 5 }, () =>
        repositories.identityAccess.ensureUserForAuthIdentity({
          authUserId,
          displayName: "Concurrent member",
          email: "concurrent-member@example.test",
          imageUrl: null,
        }),
      ),
    );

    expect(new Set(provisionedUsers.map((user) => user.id))).toHaveLength(1);
    await expect(
      database.select().from(users).where(eq(users.authUserId, authUserId)),
    ).resolves.toHaveLength(1);
  });

  it("does not reactivate an archived product user during identity provisioning", async () => {
    const repositories = createRepositories(database);
    const authUserId = randomUUID();
    await database.insert(authUsers).values({
      email: `archived-${authUserId}@example.test`,
      emailVerified: true,
      id: authUserId,
      name: "Active member",
    });
    const user = await repositories.identityAccess.ensureUserForAuthIdentity({
      authUserId,
      displayName: "Active member",
      email: "active-member@example.test",
      imageUrl: null,
    });
    const archivedAt = new Date("2026-07-29T04:00:00.000Z");
    await database
      .update(users)
      .set({ archivedAt })
      .where(eq(users.id, user.id));

    await expect(
      repositories.identityAccess.ensureUserForAuthIdentity({
        authUserId,
        displayName: "Renamed archived member",
        email: "renamed-archived-member@example.test",
        imageUrl: null,
      }),
    ).resolves.toMatchObject({ archivedAt, id: user.id });
  });

  it("creates, resolves, and consumes an invitation hash only once", async () => {
    const repositories = createRepositories(database);
    const owner = await repositories.identityAccess.createUser({
      displayName: "Invitation Owner",
    });
    const member = await repositories.identityAccess.createUser({
      displayName: "Invited Member",
    });
    const [group] = await database
      .insert(groups)
      .values({ createdByUserId: owner.id, name: "Invitation Group" })
      .returning();
    if (group === undefined) {
      throw new Error("Expected the invitation group to be created.");
    }

    const invitation = await repositories.groupAccess.createInvitation({
      createdByUserId: owner.id,
      expiresAt: new Date("2026-07-31T08:00:00.000Z"),
      groupId: group.id,
      tokenHash: randomUUID().replaceAll("-", ""),
    });
    await expect(
      repositories.groupAccess.findInvitationByTokenHash(invitation.tokenHash),
    ).resolves.toMatchObject({ id: invitation.id });
    await expect(
      repositories.groupAccess.acceptInvitation(
        invitation.id,
        member.id,
        new Date("2026-07-29T08:00:00.000Z"),
      ),
    ).resolves.toBe(true);
    await expect(
      repositories.groupAccess.acceptInvitation(
        invitation.id,
        member.id,
        new Date("2026-07-29T08:01:00.000Z"),
      ),
    ).resolves.toBe(false);
  });

  it("persists owner-managed roles, removal, and one pending admin request", async () => {
    const repositories = createRepositories(database);
    const owner = await repositories.identityAccess.createUser({
      displayName: "Access Owner",
    });
    const member = await repositories.identityAccess.createUser({
      displayName: "Access Member",
    });
    const [group] = await database
      .insert(groups)
      .values({ createdByUserId: owner.id, name: "Access Group" })
      .returning();
    if (group === undefined) {
      throw new Error("Expected the access group to be created.");
    }
    await repositories.identityAccess.addMembership({
      groupId: group.id,
      role: "owner",
      userId: owner.id,
    });
    await repositories.identityAccess.addMembership({
      groupId: group.id,
      role: "member",
      userId: member.id,
    });

    await expect(
      repositories.groupAccess.listActiveMembers(group.id),
    ).resolves.toMatchObject([
      { displayName: "Access Member", role: "member", userId: member.id },
      { displayName: "Access Owner", role: "owner", userId: owner.id },
    ]);
    await expect(
      repositories.groupAccess.setMembershipRole(
        group.id,
        member.id,
        "member",
        "manager",
      ),
    ).resolves.toBe(true);
    await expect(
      repositories.groupAccess.removeMembership(
        group.id,
        member.id,
        new Date("2026-07-29T09:00:00.000Z"),
      ),
    ).resolves.toBe(true);
    await expect(
      repositories.identityAccess.addMembership({
        groupId: group.id,
        joinedAt: new Date("2026-07-29T10:00:00.000Z"),
        role: "member",
        userId: member.id,
      }),
    ).resolves.toMatchObject({
      groupId: group.id,
      removedAt: null,
      role: "member",
      userId: member.id,
    });

    const request = await repositories.groupAccess.createAdminAccessRequest({
      groupId: group.id,
      requesterUserId: owner.id,
    });
    await expect(
      repositories.groupAccess.findPendingAdminAccessRequest(owner.id),
    ).resolves.toMatchObject({ id: request.id, status: "pending" });
  });

  it("persists and rotates persistent group invite links", async () => {
    const repositories = createRepositories(database);
    const owner = await repositories.identityAccess.createUser({
      displayName: "Invite Link Owner",
    });
    const [group] = await database
      .insert(groups)
      .values({ createdByUserId: owner.id, name: "Invite Link Group" })
      .returning();
    if (group === undefined) {
      throw new Error("Expected the invite-link group to be created.");
    }
    await repositories.identityAccess.addMembership({
      groupId: group.id,
      role: "owner",
      userId: owner.id,
    });

    const created = await repositories.groupAccess.createInviteLink({
      groupId: group.id,
      tokenHash: `hash-${randomUUID()}`,
      tokenPrefix: "prefix-a",
      createdByUserId: owner.id,
      status: "active",
    });
    expect(created.status).toBe("active");

    await expect(
      repositories.groupAccess.findActiveInviteLinkForGroup(group.id),
    ).resolves.toMatchObject({ id: created.id, status: "active" });
    await expect(
      repositories.groupAccess.findActiveInviteLinkByHash(created.tokenHash),
    ).resolves.toMatchObject({ id: created.id });

    const rotatedAt = new Date("2026-08-04T12:00:00.000Z");
    await expect(
      repositories.groupAccess.markInviteLinkRotated(created.id, rotatedAt),
    ).resolves.toBe(true);
    await expect(
      repositories.groupAccess.findActiveInviteLinkForGroup(group.id),
    ).resolves.toBeUndefined();
    await expect(
      repositories.groupAccess.findActiveInviteLinkByHash(created.tokenHash),
    ).resolves.toBeUndefined();

    const summary = await repositories.groupAccess.findGroupSummary(group.id);
    expect(summary).toMatchObject({
      id: group.id,
      name: "Invite Link Group",
      ownerUserId: owner.id,
    });
  });

  it("lists users with profile, admin flag, and active memberships", async () => {
    const repositories = createRepositories(database);

    const ownerAuthId = randomUUID();
    const memberAuthId = randomUUID();
    const noAuthProductId = randomUUID();
    // Email/image live on auth_users (Better Auth owns them). The values passed
    // to ensureUserForAuthIdentity are not persisted — they pass through to
    // AppIdentity at runtime — so the canonical email used in assertions is the
    // one seeded into auth_users below.
    const ownerEmail = `summary-owner-${ownerAuthId}@example.test`;
    const memberEmail = `summary-member-${memberAuthId}@example.test`;

    await database.insert(authUsers).values({
      email: ownerEmail,
      emailVerified: true,
      id: ownerAuthId,
      name: "Summary Owner",
    });
    await database.insert(authUsers).values({
      email: memberEmail,
      emailVerified: true,
      id: memberAuthId,
      name: "Summary Member",
      image: "https://example.test/member.png",
    });

    const owner = await repositories.identityAccess.ensureUserForAuthIdentity({
      authUserId: ownerAuthId,
      displayName: "Summary Owner",
      email: ownerEmail,
      imageUrl: null,
    });
    const member = await repositories.identityAccess.ensureUserForAuthIdentity({
      authUserId: memberAuthId,
      displayName: "Summary Member",
      email: memberEmail,
      imageUrl: "https://example.test/member.png",
    });
    // User with no linked auth_users row (authUserId null) — insert directly.
    await database.insert(users).values({
      displayName: "No Auth User",
      id: noAuthProductId,
    });
    // Archived user — should be excluded from the summary.
    const archivedAuthId = randomUUID();
    await database.insert(authUsers).values({
      email: `summary-archived-${archivedAuthId}@example.test`,
      emailVerified: true,
      id: archivedAuthId,
      name: "Archived User",
    });
    const archived =
      await repositories.identityAccess.ensureUserForAuthIdentity({
        authUserId: archivedAuthId,
        displayName: "Archived User",
        email: "summary-archived@example.test",
        imageUrl: null,
      });
    await database
      .update(users)
      .set({ archivedAt: new Date("2026-08-13T00:00:00.000Z") })
      .where(eq(users.id, archived.id));

    const [groupA] = await database
      .insert(groups)
      .values({ createdByUserId: owner.id, name: "Summary Group A" })
      .returning();
    const [groupB] = await database
      .insert(groups)
      .values({ createdByUserId: owner.id, name: "Summary Group B" })
      .returning();
    if (groupA === undefined || groupB === undefined) {
      throw new Error("Expected summary test groups to be created.");
    }
    await repositories.identityAccess.addMembership({
      groupId: groupA.id,
      role: "owner",
      userId: owner.id,
    });
    await repositories.identityAccess.addMembership({
      groupId: groupB.id,
      role: "manager",
      userId: owner.id,
    });
    await repositories.identityAccess.addMembership({
      groupId: groupA.id,
      role: "member",
      userId: member.id,
    });
    // A removed membership — should NOT appear in the summary.
    await repositories.identityAccess.addMembership({
      groupId: groupB.id,
      role: "member",
      userId: member.id,
    });
    await repositories.groupAccess.removeMembership(
      groupB.id,
      member.id,
      new Date("2026-08-13T01:00:00.000Z"),
    );

    await repositories.identityAccess.setPlatformAdminFlag(owner.id, true);

    const summaries =
      await repositories.identityAccess.listUsersWithSummary();

    // Archived user is excluded.
    expect(summaries.find((u) => u.id === archived.id)).toBeUndefined();

    const fetchedOwner = summaries.find((u) => u.id === owner.id);
    expect(fetchedOwner).toBeDefined();
    expect(fetchedOwner).toMatchObject({
      displayName: "Summary Owner",
      email: ownerEmail,
      imageUrl: null,
      isPlatformAdmin: true,
    });
    expect(fetchedOwner?.memberships).toHaveLength(2);
    expect(fetchedOwner?.memberships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ groupId: groupA.id, role: "owner" }),
        expect.objectContaining({ groupId: groupB.id, role: "manager" }),
      ]),
    );

    const fetchedMember = summaries.find((u) => u.id === member.id);
    expect(fetchedMember).toMatchObject({
      displayName: "Summary Member",
      email: memberEmail,
      imageUrl: "https://example.test/member.png",
      isPlatformAdmin: false,
    });
    expect(fetchedMember?.memberships).toEqual([
      { groupId: groupA.id, role: "member" },
    ]);

    // User without an auth row still appears with nullish profile fields and no memberships.
    const fetchedNoAuth = summaries.find((u) => u.id === noAuthProductId);
    expect(fetchedNoAuth).toMatchObject({
      displayName: "No Auth User",
      email: null,
      imageUrl: null,
      isPlatformAdmin: false,
      memberships: [],
    });

    // Ordered alphabetically by displayName.
    const names = summaries.map((u) => u.displayName);
    const sortedNames = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sortedNames);
  });
});

/**
 * Forces the surrounding drizzle transaction to roll back while still
 * returning the test body's value, so each V1-06 decide-flow test runs
 * in isolation against the shared temporary schema.
 */
class RollbackSignal extends Error {
  constructor(public readonly result: unknown) {
    super("ROLLBACK_SIGNAL");
    this.name = "RollbackSignal";
  }
}

/** Runs a test body inside a transaction that always rolls back. */
async function withRolledBackRepositories<T>(
  test: (repositories: Repositories, tx: DatabaseTransaction) => Promise<T>,
): Promise<T> {
  try {
    await database.transaction(async (transaction) => {
      const repositories = createRepositories(transaction);
      const result = await test(repositories, transaction);
      throw new RollbackSignal(result);
    });
    throw new Error("Rolled back transaction should not commit.");
  } catch (error) {
    if (error instanceof RollbackSignal) {
      return error.result as T;
    }
    throw error;
  }
}

/** Inserts a Better Auth user row so a product user can reference it. */
async function insertAuthUser(
  tx: DatabaseTransaction,
  authUserId: string,
  name: string,
): Promise<void> {
  await tx.insert(authUsers).values({
    email: `${name.toLowerCase().replaceAll(" ", "-")}-${authUserId}@example.test`,
    emailVerified: true,
    id: authUserId,
    name,
  });
}

/** Seeds the four rows V1-06 decide-flow tests need to exercise. */
async function seedPendingRequestFixture(
  repositories: Repositories,
  tx: DatabaseTransaction,
): Promise<{
  readonly decidingAdminId: string;
  readonly groupId: string;
  readonly requestId: string;
  readonly requesterId: string;
}> {
  const requesterAuthId = randomUUID();
  await insertAuthUser(tx, requesterAuthId, "Owner Riley");
  const requester = await repositories.identityAccess.ensureUserForAuthIdentity(
    {
      authUserId: requesterAuthId,
      displayName: "Owner Riley",
      email: "owner-riley@example.test",
      imageUrl: null,
    },
  );
  const decidingAdminAuthId = randomUUID();
  await insertAuthUser(tx, decidingAdminAuthId, "Admin Quinn");
  const decidingAdmin =
    await repositories.identityAccess.ensureUserForAuthIdentity({
      authUserId: decidingAdminAuthId,
      displayName: "Admin Quinn",
      email: "admin-quinn@example.test",
      imageUrl: null,
    });
  await repositories.identityAccess.setPlatformAdminFlag(
    decidingAdmin.id,
    true,
  );
  const [group] = await tx
    .insert(groups)
    .values({ createdByUserId: requester.id, name: "Fixture Group" })
    .returning();
  if (group === undefined) {
    throw new Error("Expected the fixture group to be created.");
  }
  await repositories.identityAccess.addMembership({
    groupId: group.id,
    role: "owner",
    userId: requester.id,
  });
  const request = await repositories.groupAccess.createAdminAccessRequest({
    groupId: group.id,
    requesterUserId: requester.id,
  });
  return {
    decidingAdminId: decidingAdmin.id,
    groupId: group.id,
    requestId: request.id,
    requesterId: requester.id,
  };
}

describe("group access V1-06 decide flow", () => {
  it("lists pending requests with requester and group names", async () => {
    await withRolledBackRepositories(async (repositories, tx) => {
      const requesterAuthId = randomUUID();
      await insertAuthUser(tx, requesterAuthId, "Owner Riley");
      const requester =
        await repositories.identityAccess.ensureUserForAuthIdentity({
          authUserId: requesterAuthId,
          displayName: "Owner Riley",
          email: "owner-riley@example.test",
          imageUrl: null,
        });
      const [group] = await tx
        .insert(groups)
        .values({ createdByUserId: requester.id, name: "List Group" })
        .returning();
      if (group === undefined) {
        throw new Error("Expected the list test group to be created.");
      }
      await repositories.identityAccess.addMembership({
        groupId: group.id,
        role: "owner",
        userId: requester.id,
      });
      const request = await repositories.groupAccess.createAdminAccessRequest({
        groupId: group.id,
        requesterUserId: requester.id,
      });

      const pending =
        await repositories.groupAccess.listPendingAdminAccessRequests();
      const matched = pending.find((row) => row.id === request.id);
      expect(matched).toBeDefined();
      expect(matched).toEqual(
        expect.objectContaining({
          id: request.id,
          requesterUserId: requester.id,
          requesterDisplayName: "Owner Riley",
          groupId: group.id,
          groupName: "List Group",
          status: "pending",
        }),
      );
    });
  });

  it("approves a pending request and exposes the new status", async () => {
    await withRolledBackRepositories(async (repositories, tx) => {
      const { decidingAdminId, requestId } = await seedPendingRequestFixture(
        repositories,
        tx,
      );

      const updated = await repositories.groupAccess.decideAdminAccessRequest({
        requestId,
        decision: "approved",
        decidedByUserId: decidingAdminId,
        decidedAt: new Date("2026-07-30T10:00:00.000Z"),
      });
      expect(updated.status).toBe("approved");
      expect(updated.decidedByUserId).toBe(decidingAdminId);
      expect(updated.decisionReason).toBeNull();
    });
  });

  it("throws when deciding a request that is no longer pending", async () => {
    await withRolledBackRepositories(async (repositories, tx) => {
      const { decidingAdminId, requestId } = await seedPendingRequestFixture(
        repositories,
        tx,
      );

      await repositories.groupAccess.decideAdminAccessRequest({
        requestId,
        decision: "rejected",
        decidedByUserId: decidingAdminId,
        decidedAt: new Date("2026-07-30T10:00:00.000Z"),
      });
      await expect(
        repositories.groupAccess.decideAdminAccessRequest({
          requestId,
          decision: "approved",
          decidedByUserId: decidingAdminId,
          decidedAt: new Date("2026-07-30T10:00:01.000Z"),
        }),
      ).rejects.toThrow();
    });
  });

  it("promotes a user to platform admin and finds a request by id", async () => {
    await withRolledBackRepositories(async (repositories, tx) => {
      const { decidingAdminId, requestId, requesterId } =
        await seedPendingRequestFixture(repositories, tx);

      const before =
        await repositories.groupAccess.findAdminAccessRequestById(requestId);
      expect(before?.status).toBe("pending");

      await repositories.groupAccess.promoteToPlatformAdmin(requesterId);
      await repositories.groupAccess.promoteToPlatformAdmin(decidingAdminId);

      const direct = await tx
        .select({ isPlatformAdmin: users.isPlatformAdmin })
        .from(users)
        .where(eq(users.id, requesterId))
        .limit(1);
      expect(direct[0]?.isPlatformAdmin).toBe(true);
    });
  });
});
