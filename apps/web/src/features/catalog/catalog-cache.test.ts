import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  cacheLife,
  cacheTag,
  getRestaurantDetail,
  listRestaurantPreviews,
  revalidateTag,
} = vi.hoisted(() => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  getRestaurantDetail: vi.fn(() => Promise.resolve(null)),
  listRestaurantPreviews: vi.fn(() => Promise.resolve([])),
  revalidateTag: vi.fn(),
}));

vi.mock("next/cache", () => ({ cacheLife, cacheTag, revalidateTag }));
vi.mock("./catalog-runtime", () => ({
  catalogRuntime: {
    catalog: { getRestaurantDetail, listRestaurantPreviews },
  },
}));

import {
  getCachedRestaurantDetail,
  invalidatePublishedCatalog,
  listCachedRestaurantPreviews,
} from "./catalog-cache";

describe("published catalog cache", () => {
  beforeEach(() => vi.clearAllMocks());

  it("caches bounded restaurant previews under the shared catalog tag", async () => {
    await listCachedRestaurantPreviews({ limit: 6 });

    expect(cacheLife).toHaveBeenCalledWith("hours");
    expect(cacheTag).toHaveBeenCalledWith("published-catalog");
    expect(listRestaurantPreviews).toHaveBeenCalledWith({ limit: 6 });
  });

  it("tags restaurant detail with both shared and resource tags", async () => {
    await getCachedRestaurantDetail("restaurant-1");

    expect(cacheTag).toHaveBeenCalledWith(
      "published-catalog",
      "restaurant-restaurant-1",
    );
    expect(getRestaurantDetail).toHaveBeenCalledWith("restaurant-1");
  });

  it("invalidates shared and optional restaurant cache entries", () => {
    invalidatePublishedCatalog("restaurant-1");

    expect(revalidateTag).toHaveBeenCalledWith("published-catalog", {
      expire: 0,
    });
    expect(revalidateTag).toHaveBeenCalledWith("restaurant-restaurant-1", {
      expire: 0,
    });
  });
});
