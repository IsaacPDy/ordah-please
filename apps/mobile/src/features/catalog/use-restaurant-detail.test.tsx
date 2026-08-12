import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useRestaurantDetail } from "./use-restaurant-detail";

jest.mock("../../auth/auth-client", () => ({
  getMobileAuthClient: jest.fn(),
  readMobileApiUrl: jest.fn(),
  readMobileSessionCookie: jest.fn(),
}));

const detailFixture = {
  restaurantId: "restaurant-1",
  restaurantName: "McDonald's",
  cuisines: ["American", "Burgers"],
  branchId: "branch-1",
  branchName: "Magsaysay",
  grabUrl: null,
  menuVersionPublishedAt: "2026-08-12T00:00:00.000Z",
  categories: [
    {
      name: "Burgers",
      items: [
        {
          id: "item-1",
          name: "Classic Burger",
          description: "Beef burger",
          priceCentavos: 25000,
          availability: "available",
          imageUrl: "https://example.test/burger.avif",
          variants: [],
          modifierGroups: [],
        },
      ],
    },
  ],
};

/** Creates one JSON response for restaurant-detail hook tests. */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

describe("useRestaurantDetail", () => {
  it("loads and validates one authenticated restaurant menu", async () => {
    let resolveRequest: ((response: Response) => void) | undefined;
    const request = jest.fn(
      (input: string, init: RequestInit) =>
        new Promise<Response>((resolve) => {
          void input;
          void init;
          resolveRequest = resolve;
        }),
    );
    const { result } = await renderHook(() =>
      useRestaurantDetail("restaurant-1", {
        readApiUrl: () => "https://preview.ordah-please.test",
        readSessionCookie: () => "session=opaque",
        request,
      }),
    );

    expect(result.current.kind).toBe("loading");
    await act(() => {
      resolveRequest?.(jsonResponse({ data: detailFixture, ok: true }));
    });
    await waitFor(() => expect(result.current.kind).toBe("ready"));
    expect(result.current).toMatchObject({
      detail: detailFixture,
      kind: "ready",
    });
    expect(request).toHaveBeenCalledWith(
      "https://preview.ordah-please.test/api/catalog/restaurants/restaurant-1",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("does not request catalog data for a missing route id", async () => {
    const request = jest.fn((input: string, init: RequestInit) => {
      void input;
      void init;
      return Promise.resolve(jsonResponse({ data: detailFixture, ok: true }));
    });
    const { result } = await renderHook(() =>
      useRestaurantDetail(null, {
        readApiUrl: () => "https://preview.ordah-please.test",
        readSessionCookie: () => "session=opaque",
        request,
      }),
    );

    expect(result.current.kind).toBe("invalid");
    expect(request).not.toHaveBeenCalled();
  });
});
