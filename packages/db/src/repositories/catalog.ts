import {
  and,
  asc,
  countDistinct,
  desc,
  eq,
  inArray,
  isNull,
} from "drizzle-orm";

import type { Database } from "../client.js";
import {
  branches,
  catalogImports,
  menuCategories,
  menuItems,
  menuVersions,
  restaurants,
} from "../schema/index.js";
import type { DatabaseTransaction } from "../transaction.js";

export interface MenuItemContextRow {
  readonly menuItemId: string;
  readonly name: string;
  readonly basePriceCentavos: number;
  readonly isAvailable: boolean;
  readonly branchId: string;
  readonly menuVersionId: string;
}

export interface RestaurantSummaryRow {
  readonly restaurantId: string;
  readonly restaurantName: string;
  readonly cuisines: readonly string[];
  readonly branchId: string;
  readonly branchName: string;
  readonly heroImageUrl: string | null;
}

export interface RestaurantDetailItemRow {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly basePriceCentavos: number;
  readonly isAvailable: boolean;
  readonly imageUrl: string | null;
  readonly sortOrder: number;
}

export interface RestaurantDetailCategoryRow {
  readonly name: string;
  readonly items: readonly RestaurantDetailItemRow[];
}

export interface RestaurantDetailRow {
  readonly restaurantId: string;
  readonly restaurantName: string;
  readonly cuisines: readonly string[];
  readonly branchId: string;
  readonly branchName: string;
  readonly grabUrl: string | null;
  readonly menuVersionPublishedAt: Date;
  readonly categories: readonly RestaurantDetailCategoryRow[];
}

export interface CatalogImportInputRow {
  readonly restaurantName: string;
  readonly branchName: string;
  readonly sourceRestaurantId: string;
  readonly sourceUrl: string;
  readonly cuisines: readonly string[];
  readonly categoryName: string;
  readonly itemName: string;
  readonly description: string | null;
  readonly priceCentavos: number;
  readonly imageUrl: string | null;
  readonly isAvailable: boolean;
  readonly collectedAt: string;
}

export interface CatalogImportWarningRow {
  readonly row: number;
  readonly reason: string;
}

export interface CatalogImportResult {
  readonly restaurantsAdded: number;
  readonly restaurantsUpdated: number;
  readonly itemsAdded: number;
  readonly itemsSkipped: number;
  readonly warnings: readonly CatalogImportWarningRow[];
}

export interface RecentCatalogImportRow {
  readonly id: string;
  readonly sourceFileName: string | null;
  readonly restaurantCount: number;
  readonly status: "draft" | "failed" | "invalid" | "published" | "validated";
  readonly createdAt: Date;
}

export interface RestaurantPatch {
  readonly name?: string;
  readonly cuisines?: readonly string[];
  readonly branchName?: string;
  readonly grabUrl?: string | null;
}

export interface MenuItemPatch {
  readonly name?: string;
  readonly description?: string | null;
  readonly basePriceCentavos?: number;
  readonly isAvailable?: boolean;
  readonly imageUrl?: string | null;
}

type CatalogDatabase = Database | DatabaseTransaction;

export interface CatalogRepository {
  findPublishedMenuVersion(
    branchId: string,
  ): Promise<typeof menuVersions.$inferSelect | undefined>;
  findMenuItemContext(
    menuItemId: string,
  ): Promise<MenuItemContextRow | undefined>;
  listRestaurants(): Promise<readonly RestaurantSummaryRow[]>;
  getRestaurantDetail(
    restaurantId: string,
  ): Promise<RestaurantDetailRow | null>;
  importCatalog(
    userId: string,
    sourceFileName: string,
    rows: readonly CatalogImportInputRow[],
    warnings: readonly CatalogImportWarningRow[],
  ): Promise<CatalogImportResult>;
  listRecentImports(): Promise<readonly RecentCatalogImportRow[]>;
  updateRestaurant(
    restaurantId: string,
    patch: RestaurantPatch,
  ): Promise<boolean>;
  updateMenuItem(itemId: string, patch: MenuItemPatch): Promise<boolean>;
}

/** Creates read and write operations for the catalog schema. */
export function createCatalogRepository(
  database: CatalogDatabase,
): CatalogRepository {
  return {
    findMenuItemContext: async (menuItemId) => {
      const [row] = await database
        .select({
          menuItemId: menuItems.id,
          name: menuItems.name,
          basePriceCentavos: menuItems.basePriceCentavos,
          isAvailable: menuItems.isAvailable,
          branchId: branches.id,
          menuVersionId: menuVersions.id,
        })
        .from(menuItems)
        .innerJoin(menuCategories, eq(menuCategories.id, menuItems.categoryId))
        .innerJoin(
          menuVersions,
          and(
            eq(menuVersions.id, menuCategories.menuVersionId),
            eq(menuVersions.status, "published"),
          ),
        )
        .innerJoin(branches, eq(branches.id, menuVersions.branchId))
        .where(eq(menuItems.id, menuItemId))
        .limit(1);
      return row;
    },

    findPublishedMenuVersion: async (branchId) => {
      const [menuVersion] = await database
        .select()
        .from(menuVersions)
        .where(
          and(
            eq(menuVersions.branchId, branchId),
            eq(menuVersions.status, "published"),
          ),
        )
        .limit(1);
      return menuVersion;
    },

    listRestaurants: async () => {
      const rows = await database
        .select({
          restaurantId: restaurants.id,
          restaurantName: restaurants.name,
          cuisines: restaurants.cuisines,
          branchId: branches.id,
          branchName: branches.name,
          menuVersionId: menuVersions.id,
        })
        .from(restaurants)
        .innerJoin(branches, eq(branches.restaurantId, restaurants.id))
        .innerJoin(
          menuVersions,
          and(
            eq(menuVersions.branchId, branches.id),
            eq(menuVersions.status, "published"),
          ),
        )
        .where(isNull(restaurants.archivedAt));
      if (rows.length === 0) return [];

      const menuVersionIds = rows.map((row) => row.menuVersionId);
      const candidates = await database
        .select({
          menuVersionId: menuCategories.menuVersionId,
          imageUrl: menuItems.imageUrl,
        })
        .from(menuItems)
        .innerJoin(menuCategories, eq(menuCategories.id, menuItems.categoryId))
        .where(inArray(menuCategories.menuVersionId, menuVersionIds))
        .orderBy(asc(menuCategories.sortOrder), asc(menuItems.sortOrder));

      const heroByMenuVersion = new Map<string, string>();
      for (const candidate of candidates) {
        if (
          candidate.imageUrl &&
          !heroByMenuVersion.has(candidate.menuVersionId)
        ) {
          heroByMenuVersion.set(candidate.menuVersionId, candidate.imageUrl);
        }
      }

      return rows.map((row) => ({
        restaurantId: row.restaurantId,
        restaurantName: row.restaurantName,
        cuisines: row.cuisines,
        branchId: row.branchId,
        branchName: row.branchName,
        heroImageUrl: heroByMenuVersion.get(row.menuVersionId) ?? null,
      }));
    },

    getRestaurantDetail: async (restaurantId) => {
      const [branchRow] = await database
        .select({
          restaurantId: restaurants.id,
          restaurantName: restaurants.name,
          cuisines: restaurants.cuisines,
          branchId: branches.id,
          branchName: branches.name,
          grabUrl: branches.grabUrl,
          menuVersionId: menuVersions.id,
          menuVersionPublishedAt: menuVersions.publishedAt,
        })
        .from(restaurants)
        .innerJoin(branches, eq(branches.restaurantId, restaurants.id))
        .innerJoin(
          menuVersions,
          and(
            eq(menuVersions.branchId, branches.id),
            eq(menuVersions.status, "published"),
          ),
        )
        .where(eq(restaurants.id, restaurantId))
        .limit(1);
      if (!branchRow) return null;

      const categoryRows = await database
        .select()
        .from(menuCategories)
        .where(eq(menuCategories.menuVersionId, branchRow.menuVersionId))
        .orderBy(asc(menuCategories.sortOrder));

      const itemRows = await database
        .select({
          categoryId: menuItems.categoryId,
          id: menuItems.id,
          name: menuItems.name,
          description: menuItems.description,
          basePriceCentavos: menuItems.basePriceCentavos,
          isAvailable: menuItems.isAvailable,
          imageUrl: menuItems.imageUrl,
          sortOrder: menuItems.sortOrder,
          categorySortOrder: menuCategories.sortOrder,
        })
        .from(menuItems)
        .innerJoin(menuCategories, eq(menuCategories.id, menuItems.categoryId))
        .where(eq(menuCategories.menuVersionId, branchRow.menuVersionId))
        .orderBy(asc(menuCategories.sortOrder), asc(menuItems.sortOrder));

      const itemsByCategory = new Map<string, RestaurantDetailItemRow[]>();
      for (const item of itemRows) {
        const list = itemsByCategory.get(item.categoryId) ?? [];
        list.push({
          id: item.id,
          name: item.name,
          description: item.description,
          basePriceCentavos: item.basePriceCentavos,
          isAvailable: item.isAvailable,
          imageUrl: item.imageUrl,
          sortOrder: item.sortOrder,
        });
        itemsByCategory.set(item.categoryId, list);
      }

      const categories: RestaurantDetailCategoryRow[] = categoryRows.map(
        (category) => ({
          name: category.name,
          items: itemsByCategory.get(category.id) ?? [],
        }),
      );

      return {
        restaurantId: branchRow.restaurantId,
        restaurantName: branchRow.restaurantName,
        cuisines: branchRow.cuisines,
        branchId: branchRow.branchId,
        branchName: branchRow.branchName,
        grabUrl: branchRow.grabUrl,
        menuVersionPublishedAt: branchRow.menuVersionPublishedAt ?? new Date(),
        categories,
      };
    },

    importCatalog: async (userId, sourceFileName, rows, warnings) => {
      const grouped = new Map<string, CatalogImportInputRow[]>();
      for (const row of rows) {
        const list = grouped.get(row.sourceRestaurantId) ?? [];
        list.push(row);
        grouped.set(row.sourceRestaurantId, list);
      }

      const counts = {
        restaurantsAdded: 0,
        restaurantsUpdated: 0,
        itemsAdded: 0,
      };

      await database.transaction(async (tx) => {
        const [importRow] = await tx
          .insert(catalogImports)
          .values({
            createdByUserId: userId,
            sourceFileName,
            status: "published",
            publishedAt: new Date(),
          })
          .returning({ id: catalogImports.id });

        for (const [, groupRows] of grouped) {
          const first = groupRows[0];
          if (!first) continue;

          const [existingBranchBySource] = await tx
            .select()
            .from(branches)
            .where(eq(branches.sourceKey, first.sourceRestaurantId))
            .limit(1);

          const [existingRestaurantByName] = existingBranchBySource
            ? []
            : await tx
                .select()
                .from(restaurants)
                .where(eq(restaurants.name, first.restaurantName))
                .limit(1);

          let restaurantId: string;
          if (existingBranchBySource) {
            await tx
              .update(restaurants)
              .set({
                name: first.restaurantName,
                cuisines: [...first.cuisines],
                updatedAt: new Date(),
              })
              .where(eq(restaurants.id, existingBranchBySource.restaurantId));
            restaurantId = existingBranchBySource.restaurantId;
            counts.restaurantsUpdated += 1;
          } else if (existingRestaurantByName) {
            await tx
              .update(restaurants)
              .set({
                cuisines: [...first.cuisines],
                updatedAt: new Date(),
              })
              .where(eq(restaurants.id, existingRestaurantByName.id));
            restaurantId = existingRestaurantByName.id;
            counts.restaurantsUpdated += 1;
          } else {
            const [inserted] = await tx
              .insert(restaurants)
              .values({
                name: first.restaurantName,
                cuisines: [...first.cuisines],
              })
              .returning({ id: restaurants.id });
            restaurantId = inserted!.id;
            counts.restaurantsAdded += 1;
          }

          let branchId: string;
          if (existingBranchBySource) {
            await tx
              .update(branches)
              .set({
                name: first.branchName,
                grabUrl: first.sourceUrl,
                updatedAt: new Date(),
              })
              .where(eq(branches.id, existingBranchBySource.id));
            branchId = existingBranchBySource.id;
          } else {
            const [insertedBranch] = await tx
              .insert(branches)
              .values({
                restaurantId,
                sourceKey: first.sourceRestaurantId,
                name: first.branchName,
                grabUrl: first.sourceUrl,
              })
              .returning({ id: branches.id });
            branchId = insertedBranch!.id;
          }

          const [currentPublished] = await tx
            .select()
            .from(menuVersions)
            .where(
              and(
                eq(menuVersions.branchId, branchId),
                eq(menuVersions.status, "published"),
              ),
            )
            .limit(1);

          if (currentPublished) {
            await tx
              .update(menuVersions)
              .set({ status: "superseded" })
              .where(eq(menuVersions.id, currentPublished.id));
          }

          const nextVersionNumber = currentPublished
            ? currentPublished.versionNumber + 1
            : 1;

          const collectedDate = new Date(`${first.collectedAt}T00:00:00.000Z`);
          const [newVersion] = await tx
            .insert(menuVersions)
            .values({
              branchId,
              sourceImportId: importRow!.id,
              versionNumber: nextVersionNumber,
              status: "published",
              publishedAt: collectedDate,
            })
            .returning({ id: menuVersions.id });
          const menuVersionId = newVersion!.id;

          const categoryNameToId = new Map<string, string>();
          let categorySort = 0;
          for (const row of groupRows) {
            if (categoryNameToId.has(row.categoryName)) continue;
            const [insertedCategory] = await tx
              .insert(menuCategories)
              .values({
                menuVersionId,
                name: row.categoryName,
                sortOrder: categorySort++,
              })
              .returning({ id: menuCategories.id });
            categoryNameToId.set(row.categoryName, insertedCategory!.id);
          }

          const itemOrderInCategory = new Map<string, number>();
          for (const row of groupRows) {
            const categoryId = categoryNameToId.get(row.categoryName)!;
            const nextSort = itemOrderInCategory.get(row.categoryName) ?? 0;
            itemOrderInCategory.set(row.categoryName, nextSort + 1);
            await tx.insert(menuItems).values({
              categoryId,
              sourceKey: row.itemName,
              name: row.itemName,
              description: row.description,
              basePriceCentavos: row.priceCentavos,
              isAvailable: row.isAvailable,
              imageUrl: row.imageUrl,
              sortOrder: nextSort,
            });
            counts.itemsAdded += 1;
          }
        }
      });

      return {
        restaurantsAdded: counts.restaurantsAdded,
        restaurantsUpdated: counts.restaurantsUpdated,
        itemsAdded: counts.itemsAdded,
        itemsSkipped: warnings.length,
        warnings,
      };
    },

    listRecentImports: async () =>
      database
        .select({
          createdAt: catalogImports.createdAt,
          id: catalogImports.id,
          restaurantCount: countDistinct(menuVersions.branchId),
          sourceFileName: catalogImports.sourceFileName,
          status: catalogImports.status,
        })
        .from(catalogImports)
        .leftJoin(
          menuVersions,
          eq(menuVersions.sourceImportId, catalogImports.id),
        )
        .groupBy(
          catalogImports.id,
          catalogImports.sourceFileName,
          catalogImports.status,
          catalogImports.createdAt,
        )
        .orderBy(desc(catalogImports.createdAt))
        .limit(20),

    updateRestaurant: async (restaurantId, patch) => {
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (patch.name !== undefined) updates.name = patch.name;
      if (patch.cuisines !== undefined) updates.cuisines = [...patch.cuisines];
      return database.transaction(async (tx) => {
        const updated = await tx
          .update(restaurants)
          .set(updates)
          .where(eq(restaurants.id, restaurantId))
          .returning({ id: restaurants.id });
        if (updated.length === 0) return false;

        const branchUpdates: Record<string, unknown> = {
          updatedAt: new Date(),
        };
        if (patch.branchName !== undefined)
          branchUpdates.name = patch.branchName;
        if (patch.grabUrl !== undefined) branchUpdates.grabUrl = patch.grabUrl;
        if (Object.keys(branchUpdates).length > 1) {
          await tx
            .update(branches)
            .set(branchUpdates)
            .where(eq(branches.restaurantId, restaurantId));
        }
        return true;
      });
    },

    updateMenuItem: async (itemId, patch) => {
      const updates: Record<string, unknown> = {};
      if (patch.name !== undefined) updates.name = patch.name;
      if (patch.description !== undefined)
        updates.description = patch.description;
      if (patch.basePriceCentavos !== undefined) {
        updates.basePriceCentavos = patch.basePriceCentavos;
      }
      if (patch.isAvailable !== undefined)
        updates.isAvailable = patch.isAvailable;
      if (patch.imageUrl !== undefined) updates.imageUrl = patch.imageUrl;
      const updated = await database
        .update(menuItems)
        .set(updates)
        .where(eq(menuItems.id, itemId))
        .returning({ id: menuItems.id });
      return updated.length > 0;
    },
  };
}
