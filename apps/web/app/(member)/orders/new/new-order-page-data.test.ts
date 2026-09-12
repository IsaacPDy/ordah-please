import { describe, expect, it, vi } from "vitest";

import { loadNewOrderPageData } from "./new-order-page-data";

describe("new order page data", () => {
  it("starts every bounded setup read together", () => {
    const pending = new Promise<never>(() => undefined);
    const dependencies = {
      findGroupAddress: vi.fn(() => pending),
      findGroupSummary: vi.fn(() => pending),
      listActiveMembers: vi.fn(() => pending),
      listRestaurantPreviews: vi.fn(() => pending),
    };

    void loadNewOrderPageData("group-1", dependencies);

    expect(dependencies.findGroupAddress).toHaveBeenCalledWith("group-1");
    expect(dependencies.findGroupSummary).toHaveBeenCalledWith("group-1");
    expect(dependencies.listActiveMembers).toHaveBeenCalledWith("group-1");
    expect(dependencies.listRestaurantPreviews).toHaveBeenCalledWith({
      limit: 100,
    });
  });
});
