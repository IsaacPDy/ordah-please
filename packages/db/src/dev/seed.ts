import type { Database } from "../client.js";
import {
  branches,
  catalogImports,
  groups,
  memberships,
  menuCategories,
  menuItemModifierGroups,
  menuItems,
  menuModifierGroups,
  menuModifierOptions,
  menuVariants,
  menuVersions,
  restaurants,
  users,
} from "../schema/index.js";
import { withTransaction } from "../transaction.js";
import { developmentFixtures } from "./fixtures.js";

export const DEVELOPMENT_SEED_CONFIRMATION =
  "ordah-please-development-seed" as const;

export interface DevelopmentSeedGuard {
  readonly confirmation: typeof DEVELOPMENT_SEED_CONFIRMATION;
  readonly environment: "development";
}

export interface DevelopmentSeedSummary {
  readonly branches: 1;
  readonly groups: 1;
  readonly menuItems: 2;
  readonly restaurants: 1;
  readonly users: 2;
}

/** Validates the explicit development-only guard before any fixture can touch the database. */
export function readDevelopmentSeedGuard(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): DevelopmentSeedGuard {
  if (environment.NODE_ENV !== "development") {
    throw new Error("Development fixtures require NODE_ENV=development.");
  }
  if (
    environment.DATABASE_SEED_CONFIRMATION !== DEVELOPMENT_SEED_CONFIRMATION
  ) {
    throw new Error(
      "DATABASE_SEED_CONFIRMATION must explicitly allow development seeding.",
    );
  }

  return {
    confirmation: DEVELOPMENT_SEED_CONFIRMATION,
    environment: "development",
  };
}

/** Inserts or refreshes deterministic fictional development data in one atomic transaction. */
export async function seedDevelopmentData(
  database: Database,
  guard: DevelopmentSeedGuard,
): Promise<DevelopmentSeedSummary> {
  if (
    guard.environment !== "development" ||
    guard.confirmation !== DEVELOPMENT_SEED_CONFIRMATION
  ) {
    throw new Error("Development seed guard is invalid.");
  }

  const fixture = developmentFixtures;

  return withTransaction(database, async (transaction) => {
    for (const user of [fixture.users.owner, fixture.users.member]) {
      await transaction
        .insert(users)
        .values(user)
        .onConflictDoUpdate({
          target: users.id,
          set: {
            archivedAt: null,
            displayName: user.displayName,
            isPlatformAdmin: user.isPlatformAdmin,
            updatedAt: user.updatedAt,
          },
        });
    }
    await transaction
      .insert(groups)
      .values({ ...fixture.group, createdByUserId: fixture.users.owner.id })
      .onConflictDoUpdate({
        target: groups.id,
        set: {
          archivedAt: null,
          name: fixture.group.name,
          updatedAt: fixture.group.updatedAt,
        },
      });
    for (const membership of [
      {
        groupId: fixture.group.id,
        joinedAt: fixture.group.createdAt,
        role: "owner" as const,
        userId: fixture.users.owner.id,
      },
      {
        groupId: fixture.group.id,
        joinedAt: fixture.group.createdAt,
        role: "member" as const,
        userId: fixture.users.member.id,
      },
    ]) {
      await transaction
        .insert(memberships)
        .values(membership)
        .onConflictDoUpdate({
          target: [memberships.groupId, memberships.userId],
          set: {
            removedAt: null,
            role: membership.role,
          },
        });
    }
    await transaction
      .insert(restaurants)
      .values(fixture.catalog.restaurant)
      .onConflictDoUpdate({
        target: restaurants.id,
        set: {
          archivedAt: null,
          name: fixture.catalog.restaurant.name,
          pausedAt: null,
          updatedAt: fixture.catalog.restaurant.updatedAt,
        },
      });
    await transaction
      .insert(branches)
      .values({
        ...fixture.catalog.branch,
        restaurantId: fixture.catalog.restaurant.id,
      })
      .onConflictDoUpdate({
        target: branches.id,
        set: {
          address: fixture.catalog.branch.address,
          archivedAt: null,
          grabUrl: fixture.catalog.branch.grabUrl,
          name: fixture.catalog.branch.name,
          sourceKey: fixture.catalog.branch.sourceKey,
          updatedAt: fixture.catalog.branch.updatedAt,
        },
      });
    await transaction
      .insert(catalogImports)
      .values({
        ...fixture.catalog.import,
        createdByUserId: fixture.users.owner.id,
      })
      .onConflictDoUpdate({
        target: catalogImports.id,
        set: {
          failureReason: null,
          publishedAt: fixture.catalog.import.publishedAt,
          status: fixture.catalog.import.status,
        },
      });
    await transaction
      .insert(menuVersions)
      .values({
        ...fixture.catalog.menuVersion,
        branchId: fixture.catalog.branch.id,
        sourceImportId: fixture.catalog.import.id,
      })
      .onConflictDoUpdate({
        target: menuVersions.id,
        set: {
          publishedAt: fixture.catalog.menuVersion.publishedAt,
          status: fixture.catalog.menuVersion.status,
          versionNumber: fixture.catalog.menuVersion.versionNumber,
        },
      });
    await transaction
      .insert(menuCategories)
      .values({
        ...fixture.catalog.category,
        menuVersionId: fixture.catalog.menuVersion.id,
      })
      .onConflictDoUpdate({
        target: menuCategories.id,
        set: {
          name: fixture.catalog.category.name,
          sortOrder: fixture.catalog.category.sortOrder,
        },
      });
    for (const item of fixture.catalog.items) {
      await transaction
        .insert(menuItems)
        .values({ ...item, categoryId: fixture.catalog.category.id })
        .onConflictDoUpdate({
          target: menuItems.id,
          set: {
            basePriceCentavos: item.basePriceCentavos,
            description: item.description,
            isAvailable: item.isAvailable,
            name: item.name,
            sortOrder: item.sortOrder,
            sourceKey: item.sourceKey,
          },
        });
    }
    await transaction
      .insert(menuVariants)
      .values({
        ...fixture.catalog.variant,
        menuItemId: fixture.catalog.items[0].id,
      })
      .onConflictDoUpdate({
        target: menuVariants.id,
        set: {
          isAvailable: fixture.catalog.variant.isAvailable,
          name: fixture.catalog.variant.name,
          priceDeltaCentavos: fixture.catalog.variant.priceDeltaCentavos,
          sortOrder: fixture.catalog.variant.sortOrder,
        },
      });
    await transaction
      .insert(menuModifierGroups)
      .values({
        ...fixture.catalog.modifierGroup,
        menuVersionId: fixture.catalog.menuVersion.id,
      })
      .onConflictDoUpdate({
        target: menuModifierGroups.id,
        set: {
          maximumSelections: fixture.catalog.modifierGroup.maximumSelections,
          minimumSelections: fixture.catalog.modifierGroup.minimumSelections,
          name: fixture.catalog.modifierGroup.name,
          sortOrder: fixture.catalog.modifierGroup.sortOrder,
        },
      });
    for (const option of fixture.catalog.modifierOptions) {
      await transaction
        .insert(menuModifierOptions)
        .values({
          ...option,
          modifierGroupId: fixture.catalog.modifierGroup.id,
        })
        .onConflictDoUpdate({
          target: menuModifierOptions.id,
          set: {
            isAvailable: option.isAvailable,
            name: option.name,
            priceDeltaCentavos: option.priceDeltaCentavos,
            sortOrder: option.sortOrder,
            sourceKey: option.sourceKey,
          },
        });
    }
    await transaction
      .insert(menuItemModifierGroups)
      .values({
        menuItemId: fixture.catalog.items[0].id,
        modifierGroupId: fixture.catalog.modifierGroup.id,
      })
      .onConflictDoNothing();

    return {
      branches: 1,
      groups: 1,
      menuItems: 2,
      restaurants: 1,
      users: 2,
    };
  });
}
