import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useAppIdentity } from "./use-app-identity";

jest.mock("../../auth/auth-client", () => ({
  getMobileAuthClient: jest.fn(),
  readMobileApiUrl: jest.fn(),
  readMobileSessionCookie: jest.fn(),
}));

/** Creates one JSON API response for the native identity-hook boundary. */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

describe("useAppIdentity", () => {
  it("loads and parses every authenticated group membership", async () => {
    let resolveRequest: ((response: Response) => void) | undefined;
    const request = jest.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveRequest = resolve;
        }),
    );
    const response = jsonResponse({
      data: {
        displayName: "Mia Tan",
        email: "mia@example.com",
        imageUrl: null,
        isPlatformAdmin: false,
        memberships: [
          { groupId: "group-a", role: "group-owner" },
          { groupId: "group-b", role: "manager" },
        ],
        pendingAdminRequestCount: 0,
      },
      ok: true,
    });
    const { result } = await renderHook(() =>
      useAppIdentity({
        readApiUrl: () => "https://preview.ordah-please.test",
        readSessionCookie: () => "session=opaque",
        request,
      }),
    );

    expect(result.current.kind).toBe("loading");
    await act(() => {
      resolveRequest?.(response);
    });
    await waitFor(() => expect(result.current.kind).toBe("authenticated"));
    expect(result.current).toMatchObject({
      identity: {
        memberships: [
          { groupId: "group-a", role: "group-owner" },
          { groupId: "group-b", role: "manager" },
        ],
      },
      kind: "authenticated",
    });
    expect(request).toHaveBeenCalledWith(
      "https://preview.ordah-please.test/api/identity/me",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("treats an authenticated account with no groups as a valid identity", async () => {
    const { result } = await renderHook(() =>
      useAppIdentity({
        readApiUrl: () => "https://preview.ordah-please.test",
        readSessionCookie: () => "session=opaque",
        request: () =>
          Promise.resolve(
            jsonResponse({
              data: {
                displayName: "Mia Tan",
                email: "mia@example.com",
                imageUrl: null,
                isPlatformAdmin: false,
                memberships: [],
                pendingAdminRequestCount: 0,
              },
              ok: true,
            }),
          ),
      }),
    );

    await waitFor(() => expect(result.current.kind).toBe("authenticated"));
    expect(result.current).toMatchObject({
      identity: { memberships: [] },
      kind: "authenticated",
    });
  });

  it("separates missing sessions from retryable server failures", async () => {
    const unauthenticated = await renderHook(() =>
      useAppIdentity({
        readApiUrl: () => "https://preview.ordah-please.test",
        readSessionCookie: () => "session=expired",
        request: () => Promise.resolve(jsonResponse({}, 401)),
      }),
    );
    await waitFor(() =>
      expect(unauthenticated.result.current.kind).toBe("unauthenticated"),
    );

    let attempt = 0;
    const retryable = await renderHook(() =>
      useAppIdentity({
        readApiUrl: () => "https://preview.ordah-please.test",
        readSessionCookie: () => "session=opaque",
        request: () => {
          attempt += 1;
          return Promise.resolve(
            attempt === 1
              ? jsonResponse({}, 500)
              : jsonResponse({
                  data: {
                    displayName: "Mia Tan",
                    email: "mia@example.com",
                    imageUrl: null,
                    isPlatformAdmin: false,
                    memberships: [],
                    pendingAdminRequestCount: 0,
                  },
                  ok: true,
                }),
          );
        },
      }),
    );
    await waitFor(() => expect(retryable.result.current.kind).toBe("error"));
    await act(() => {
      retryable.result.current.retry();
    });
    await waitFor(() =>
      expect(retryable.result.current.kind).toBe("authenticated"),
    );
  });

  it("reports a network failure as retryable instead of signed out", async () => {
    const { result } = await renderHook(() =>
      useAppIdentity({
        readApiUrl: () => "https://preview.ordah-please.test",
        readSessionCookie: () => "session=opaque",
        request: () => Promise.reject(new Error("offline")),
      }),
    );

    await waitFor(() => expect(result.current.kind).toBe("error"));
  });
});
