import { describe, expect, it, vi } from "vitest";

vi.mock("./catalog-runtime", () => ({
  catalogRuntime: {},
}));

import {
  parseRestaurantDetailResponse,
  parseRestaurantListResponse,
} from "@ordah-please/contracts";
import { parseId, type UserId } from "@ordah-please/domain";

import type { AppIdentity } from "../../auth/load-app-identity";
import type { VerifiedSession } from "../../auth/verify-session";
import {
  createGetRestaurantHandler,
  createListRestaurantsHandler,
  createPatchMenuItemHandler,
  createPatchRestaurantHandler,
} from "./restaurant-route-handlers";

const session: VerifiedSession = {
  authUserId: "auth-user-1",
  displayName: "Mia",
  email: "mia@example.com",
  imageUrl: null,
};

const identity: AppIdentity = {
  ...session,
  isPlatformAdmin: false,
  memberships: [],
  userId: parseId<UserId>("user-1"),
};

/** Reads the successful route payload so the public parser can validate it. */
async function readSuccessData(response: Response): Promise<unknown> {
  const body = (await response.json()) as { data?: unknown };
  return body.data;
}

describe("catalog restaurant route handlers", () => {
  it("maps repository restaurant rows to the public list contract", async () => {
    const handler = createListRestaurantsHandler({
      list: () => [
        {
          branchId: "branch-1",
          branchName: "Magsaysay",
          cuisines: ["Burgers"],
          heroImageUrl: "https://example.com/hero.jpg",
          restaurantId: "restaurant-1",
          restaurantName: "McDonald's",
        },
      ],
      loadIdentity: () => identity,
      verifySession: () => session,
    });

    const response = await handler(
      new Request("https://ordah.test/api/catalog/restaurants"),
    );

    expect(response.status).toBe(200);
    expect(
      parseRestaurantListResponse(await readSuccessData(response)),
    ).toEqual([
      {
        branchId: "branch-1",
        branchName: "Magsaysay",
        cuisines: ["Burgers"],
        heroImageUrl: "https://example.com/hero.jpg",
        id: "restaurant-1",
        name: "McDonald's",
      },
    ]);
  });

  it("maps repository detail rows to the public restaurant contract", async () => {
    const handler = createGetRestaurantHandler(
      {
        getDetail: () => ({
          branchId: "branch-1",
          branchName: "Magsaysay",
          categories: [
            {
              items: [
                {
                  basePriceCentavos: 9900,
                  description: null,
                  id: "item-1",
                  imageUrl: null,
                  isAvailable: true,
                  name: "Cheeseburger",
                  sortOrder: 0,
                },
              ],
              name: "Burgers",
            },
          ],
          cuisines: ["Burgers"],
          grabUrl: "https://grab.example/restaurant",
          menuVersionPublishedAt: new Date("2026-08-12T04:00:00.000Z"),
          restaurantId: "restaurant-1",
          restaurantName: "McDonald's",
        }),
        loadIdentity: () => identity,
        verifySession: () => session,
      },
      () => "restaurant-1",
    );

    const response = await handler(
      new Request("https://ordah.test/api/catalog/restaurants/restaurant-1"),
    );

    expect(response.status).toBe(200);
    expect(
      parseRestaurantDetailResponse(await readSuccessData(response)),
    ).toEqual(
      expect.objectContaining({
        categories: [
          {
            items: [
              expect.objectContaining({
                availability: "available",
                description: "Cheeseburger",
                modifierGroups: [],
                priceCentavos: 9900,
                variants: [],
              }),
            ],
            name: "Burgers",
          },
        ],
        menuVersionPublishedAt: "2026-08-12T04:00:00.000Z",
      }),
    );
  });

  it("returns not found when a restaurant update affects no record", async () => {
    const patch = vi.fn(() => false);
    const handler = createPatchRestaurantHandler(
      {
        loadIdentity: () => ({ ...identity, isPlatformAdmin: true }),
        patch,
        verifySession: () => session,
      },
      () => "missing-restaurant",
    );

    const response = await handler(
      new Request("https://ordah.test/api/admin/catalog/restaurants/missing", {
        body: JSON.stringify({
          branchName: "New branch",
          grabUrl: "https://food.grab.com/new-branch",
        }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      }),
    );

    expect(response.status).toBe(404);
    expect(patch).toHaveBeenCalledWith("missing-restaurant", {
      branchName: "New branch",
      grabUrl: "https://food.grab.com/new-branch",
    });
  });

  it("returns not found when a menu item update affects no record", async () => {
    const handler = createPatchMenuItemHandler(
      {
        loadIdentity: () => ({ ...identity, isPlatformAdmin: true }),
        patch: () => false,
        verifySession: () => session,
      },
      () => "missing-item",
    );

    const response = await handler(
      new Request("https://ordah.test/api/admin/catalog/items/missing", {
        body: JSON.stringify({ name: "Missing" }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      }),
    );

    expect(response.status).toBe(404);
  });
});
