import { type CatalogImportSummary } from "@ordah-please/domain";
import type {
  RestaurantDetailRow,
  RestaurantSummaryRow,
} from "@ordah-please/db";

import { executeRoute } from "../../application/execute-route";
import { PublicApiError } from "@ordah-please/contracts";
import type { AppIdentity } from "../../auth/load-app-identity";
import type { VerifiedSession } from "../../auth/verify-session";
import { catalogRuntime } from "./catalog-runtime";

type MaybePromise<Value> = Value | Promise<Value>;

export interface ListRestaurantsHandlerDependencies {
  readonly list: () => MaybePromise<readonly RestaurantSummaryRow[]>;
  readonly loadIdentity: (
    session: VerifiedSession,
  ) => MaybePromise<AppIdentity>;
  readonly verifySession: (request: Request) => MaybePromise<VerifiedSession>;
}

export interface GetRestaurantHandlerDependencies {
  readonly getDetail: (
    restaurantId: string,
  ) => MaybePromise<RestaurantDetailRow | null>;
  readonly loadIdentity: (
    session: VerifiedSession,
  ) => MaybePromise<AppIdentity>;
  readonly verifySession: (request: Request) => MaybePromise<VerifiedSession>;
}

export interface PatchRestaurantHandlerDependencies {
  readonly loadIdentity: (
    session: VerifiedSession,
  ) => MaybePromise<AppIdentity>;
  readonly patch: (
    restaurantId: string,
    patch: {
      name?: string;
      cuisines?: readonly string[];
      branchName?: string;
      grabUrl?: string | null;
    },
  ) => MaybePromise<boolean>;
  readonly verifySession: (request: Request) => MaybePromise<VerifiedSession>;
}

export interface PatchMenuItemHandlerDependencies {
  readonly loadIdentity: (
    session: VerifiedSession,
  ) => MaybePromise<AppIdentity>;
  readonly patch: (
    itemId: string,
    patch: {
      name?: string;
      description?: string | null;
      basePriceCentavos?: number;
      isAvailable?: boolean;
      imageUrl?: string | null;
    },
  ) => MaybePromise<boolean>;
  readonly verifySession: (request: Request) => MaybePromise<VerifiedSession>;
}

/** Creates the GET handler that lists all published restaurants for any signed-in user. */
export function createListRestaurantsHandler(
  dependencies: ListRestaurantsHandlerDependencies,
): (request: Request) => Promise<Response> {
  return (request) =>
    executeRoute<Readonly<{ __: void }>, unknown>(
      request,
      {
        authorize: () => true,
        execute: async () =>
          (await dependencies.list()).map(mapRestaurantSummary),
        validate: () => ({ __: undefined }),
      },
      {
        loadIdentity: dependencies.loadIdentity,
        verifySession: () => dependencies.verifySession(request),
      },
    );
}

/** Creates the GET handler that returns one restaurant's detail with its current menu. */
export function createGetRestaurantHandler(
  dependencies: GetRestaurantHandlerDependencies,
  getRestaurantId: (request: Request) => string | undefined,
): (request: Request) => Promise<Response> {
  return (request) =>
    executeRoute<Readonly<{ restaurantId: string }>, unknown>(
      request,
      {
        authorize: () => true,
        execute: async ({ input }) => {
          const detail = await dependencies.getDetail(input.restaurantId);
          if (!detail) {
            throw new PublicApiError("NOT_FOUND", "Restaurant not found.");
          }
          return mapRestaurantDetail(detail);
        },
        validate: () => ({
          restaurantId: requireRestaurantId(getRestaurantId(request)),
        }),
      },
      {
        loadIdentity: dependencies.loadIdentity,
        verifySession: () => dependencies.verifySession(request),
      },
    );
}

/** Converts the database browse row into the stable member API shape. */
function mapRestaurantSummary(row: RestaurantSummaryRow) {
  return {
    branchId: row.branchId,
    branchName: row.branchName,
    cuisines: row.cuisines,
    heroImageUrl: row.heroImageUrl,
    id: row.restaurantId,
    name: row.restaurantName,
  };
}

/** Converts database menu fields into the stable member API shape. */
function mapRestaurantDetail(detail: RestaurantDetailRow) {
  return {
    branchId: detail.branchId,
    branchName: detail.branchName,
    categories: detail.categories.map((category) => ({
      items: category.items.map((item) => ({
        availability: item.isAvailable ? "available" : "unavailable",
        description: item.description ?? item.name,
        id: item.id,
        imageUrl: item.imageUrl,
        modifierGroups: [],
        name: item.name,
        priceCentavos: item.basePriceCentavos,
        variants: [],
      })),
      name: category.name,
    })),
    cuisines: detail.cuisines,
    grabUrl: detail.grabUrl,
    menuVersionPublishedAt: detail.menuVersionPublishedAt.toISOString(),
    restaurantId: detail.restaurantId,
    restaurantName: detail.restaurantName,
  };
}

/** Creates the PATCH handler that lets a Platform Admin edit restaurant fields. */
export function createPatchRestaurantHandler(
  dependencies: PatchRestaurantHandlerDependencies,
  getRestaurantId: (request: Request) => string | undefined,
): (request: Request) => Promise<Response> {
  return (request) =>
    executeRoute<
      Readonly<{ restaurantId: string; body: unknown }>,
      { ok: true }
    >(
      request,
      {
        authorize: ({ identity }) => {
          if (!identity.isPlatformAdmin) {
            throw new PublicApiError("FORBIDDEN", "Platform Admin only.");
          }
          return true;
        },
        execute: async ({ input }) => {
          const updated = await dependencies.patch(
            input.restaurantId,
            parseRestaurantPatch(input.body),
          );
          if (!updated) {
            throw new PublicApiError("NOT_FOUND", "Restaurant not found.");
          }
          return { ok: true as const };
        },
        validate: async (incomingRequest) => ({
          body: await incomingRequest.json(),
          restaurantId: requireRestaurantId(getRestaurantId(incomingRequest)),
        }),
      },
      {
        loadIdentity: dependencies.loadIdentity,
        verifySession: () => dependencies.verifySession(request),
      },
    );
}

/** Creates the PATCH handler that lets a Platform Admin edit one menu item. */
export function createPatchMenuItemHandler(
  dependencies: PatchMenuItemHandlerDependencies,
  getItemId: (request: Request) => string | undefined,
): (request: Request) => Promise<Response> {
  return (request) =>
    executeRoute<Readonly<{ itemId: string; body: unknown }>, { ok: true }>(
      request,
      {
        authorize: ({ identity }) => {
          if (!identity.isPlatformAdmin) {
            throw new PublicApiError("FORBIDDEN", "Platform Admin only.");
          }
          return true;
        },
        execute: async ({ input }) => {
          const updated = await dependencies.patch(
            input.itemId,
            parseMenuItemPatch(input.body),
          );
          if (!updated) {
            throw new PublicApiError("NOT_FOUND", "Menu item not found.");
          }
          return { ok: true as const };
        },
        validate: async (incomingRequest) => ({
          body: await incomingRequest.json(),
          itemId: requireItemId(getItemId(incomingRequest)),
        }),
      },
      {
        loadIdentity: dependencies.loadIdentity,
        verifySession: () => dependencies.verifySession(request),
      },
    );
}

function requireRestaurantId(value: string | undefined): string {
  if (value === undefined || value.length === 0) {
    throw new PublicApiError("INVALID_INPUT", "Restaurant id is required.");
  }
  return value;
}

function requireItemId(value: string | undefined): string {
  if (value === undefined || value.length === 0) {
    throw new PublicApiError("INVALID_INPUT", "Item id is required.");
  }
  return value;
}

function parseRestaurantPatch(body: unknown): {
  name?: string;
  cuisines?: readonly string[];
  branchName?: string;
  grabUrl?: string | null;
} {
  if (typeof body !== "object" || body === null) {
    throw new PublicApiError("INVALID_INPUT", "Body must be an object.");
  }
  const obj = body as Record<string, unknown>;
  const patch: {
    name?: string;
    cuisines?: readonly string[];
    branchName?: string;
    grabUrl?: string | null;
  } = {};
  if (obj.name !== undefined) {
    if (typeof obj.name !== "string") {
      throw new PublicApiError("INVALID_INPUT", "name must be a string.");
    }
    patch.name = obj.name;
  }
  if (obj.cuisines !== undefined) {
    if (!Array.isArray(obj.cuisines)) {
      throw new PublicApiError("INVALID_INPUT", "cuisines must be an array.");
    }
    patch.cuisines = obj.cuisines.filter(
      (entry): entry is string => typeof entry === "string",
    );
  }
  if (obj.branchName !== undefined) {
    if (typeof obj.branchName !== "string") {
      throw new PublicApiError("INVALID_INPUT", "branchName must be a string.");
    }
    patch.branchName = obj.branchName;
  }
  if (obj.grabUrl !== undefined) {
    if (obj.grabUrl !== null && typeof obj.grabUrl !== "string") {
      throw new PublicApiError(
        "INVALID_INPUT",
        "grabUrl must be a string or null.",
      );
    }
    patch.grabUrl = obj.grabUrl;
  }
  return patch;
}

function parseMenuItemPatch(body: unknown): {
  name?: string;
  description?: string | null;
  basePriceCentavos?: number;
  isAvailable?: boolean;
  imageUrl?: string | null;
} {
  if (typeof body !== "object" || body === null) {
    throw new PublicApiError("INVALID_INPUT", "Body must be an object.");
  }
  const obj = body as Record<string, unknown>;
  const patch: {
    name?: string;
    description?: string | null;
    basePriceCentavos?: number;
    isAvailable?: boolean;
    imageUrl?: string | null;
  } = {};
  if (obj.name !== undefined) {
    if (typeof obj.name !== "string") {
      throw new PublicApiError("INVALID_INPUT", "name must be a string.");
    }
    patch.name = obj.name;
  }
  if (obj.description !== undefined) {
    if (obj.description !== null && typeof obj.description !== "string") {
      throw new PublicApiError(
        "INVALID_INPUT",
        "description must be a string or null.",
      );
    }
    patch.description = obj.description;
  }
  if (obj.basePriceCentavos !== undefined) {
    if (
      typeof obj.basePriceCentavos !== "number" ||
      obj.basePriceCentavos < 0
    ) {
      throw new PublicApiError(
        "INVALID_INPUT",
        "basePriceCentavos must be a non-negative number.",
      );
    }
    patch.basePriceCentavos = obj.basePriceCentavos;
  }
  if (obj.isAvailable !== undefined) {
    if (typeof obj.isAvailable !== "boolean") {
      throw new PublicApiError(
        "INVALID_INPUT",
        "isAvailable must be a boolean.",
      );
    }
    patch.isAvailable = obj.isAvailable;
  }
  if (obj.imageUrl !== undefined) {
    if (obj.imageUrl !== null && typeof obj.imageUrl !== "string") {
      throw new PublicApiError(
        "INVALID_INPUT",
        "imageUrl must be a string or null.",
      );
    }
    patch.imageUrl = obj.imageUrl;
  }
  return patch;
}

export const listRestaurantsHandler = createListRestaurantsHandler({
  list: () => catalogRuntime.catalog.listRestaurants(),
  loadIdentity: catalogRuntime.loadIdentity,
  verifySession: catalogRuntime.verifySession,
});

export const getRestaurantHandler = (
  getRestaurantId: (request: Request) => string | undefined,
) =>
  createGetRestaurantHandler(
    {
      getDetail: (id) => catalogRuntime.catalog.getRestaurantDetail(id),
      loadIdentity: catalogRuntime.loadIdentity,
      verifySession: catalogRuntime.verifySession,
    },
    getRestaurantId,
  );

export const patchRestaurantHandler = (
  getRestaurantId: (request: Request) => string | undefined,
) =>
  createPatchRestaurantHandler(
    {
      loadIdentity: catalogRuntime.loadIdentity,
      patch: (id, patch) => catalogRuntime.catalog.updateRestaurant(id, patch),
      verifySession: catalogRuntime.verifySession,
    },
    getRestaurantId,
  );

export const patchMenuItemHandler = (
  getItemId: (request: Request) => string | undefined,
) =>
  createPatchMenuItemHandler(
    {
      loadIdentity: catalogRuntime.loadIdentity,
      patch: (id, patch) => catalogRuntime.catalog.updateMenuItem(id, patch),
      verifySession: catalogRuntime.verifySession,
    },
    getItemId,
  );

/** Type re-export for the upload handler. */
export type { CatalogImportSummary };
