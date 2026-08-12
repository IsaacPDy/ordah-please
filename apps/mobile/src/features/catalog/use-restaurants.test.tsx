import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useRestaurants } from "./use-restaurants";

jest.mock("../../auth/auth-client", () => ({
  getMobileAuthClient: jest.fn(),
  readMobileApiUrl: jest.fn(),
  readMobileSessionCookie: jest.fn(),
}));

const listFixture = [
  {
    id: "restaurant-1",
    name: "McDonald's",
    cuisines: ["American", "Burgers"],
    branchId: "branch-1",
    branchName: "Magsaysay",
    heroImageUrl: "https://example.test/photo.avif",
  },
];

/** Creates one JSON response for catalog-hook tests. */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

describe("useRestaurants", () => {
  it("loads and validates the authenticated restaurant list", async () => {
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
      useRestaurants({
        readApiUrl: () => "https://preview.ordah-please.test",
        readSessionCookie: () => "session=opaque",
        request,
      }),
    );

    expect(result.current.kind).toBe("loading");
    await act(() => {
      resolveRequest?.(jsonResponse({ data: listFixture, ok: true }));
    });
    await waitFor(() => expect(result.current.kind).toBe("ready"));
    expect(result.current).toMatchObject({
      kind: "ready",
      restaurants: listFixture,
    });
    expect(request).toHaveBeenCalledWith(
      "https://preview.ordah-please.test/api/catalog/restaurants",
      expect.objectContaining({ method: "GET" }),
    );
    const init = request.mock.calls[0]?.[1];
    expect(new Headers(init?.headers).get("cookie")).toBe("session=opaque");
  });

  it("exposes a retry after a catalog request fails", async () => {
    let attempt = 0;
    const { result } = await renderHook(() =>
      useRestaurants({
        readApiUrl: () => "https://preview.ordah-please.test",
        readSessionCookie: () => "session=opaque",
        request: () => {
          attempt += 1;
          return Promise.resolve(
            attempt === 1
              ? jsonResponse({}, 500)
              : jsonResponse({ data: listFixture, ok: true }),
          );
        },
      }),
    );

    await waitFor(() => expect(result.current.kind).toBe("error"));
    await act(() => {
      result.current.retry();
    });
    await waitFor(() => expect(result.current.kind).toBe("ready"));
  });
});
