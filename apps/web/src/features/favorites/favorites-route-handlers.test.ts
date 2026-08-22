import { describe, expect, it, vi } from "vitest";

vi.mock("./favorites-runtime", () => ({
  favoritesRuntime: {},
}));

import { PublicApiError } from "@ordah-please/contracts";
import { parseId, type FavoriteId, type MenuItemId, type UserId } from "@ordah-please/domain";

import type { AppIdentity } from "../../auth/load-app-identity";
import type { VerifiedSession } from "../../auth/verify-session";
import {
  createRemoveFavoriteHandler,
  createSaveFavoriteHandler,
} from "./favorites-route-handlers";

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

const menuItemId = parseId<MenuItemId>(
  "11111111-1111-4111-8111-111111111111",
);

/** Reads the successful route payload. */
async function readSuccessData(response: Response): Promise<unknown> {
  const body = (await response.json()) as { data?: unknown };
  return body.data;
}

/** Reads the public failure code. */
async function readFailureCode(response: Response): Promise<string> {
  const body = (await response.json()) as { error?: { code?: string } };
  return body.error?.code ?? "none";
}

const saveFavoriteMeal = vi.fn(() =>
  Promise.resolve({
    favoriteId: parseId<FavoriteId>("22222222-2222-4222-8222-222222222222"),
    rank: 1 as const,
  }),
);

const removeFavoriteMeal = vi.fn(() => Promise.resolve({ ok: true } as const));

function saveHandler(overrides: Partial<Parameters<typeof createSaveFavoriteHandler>[0]> = {}) {
  return createSaveFavoriteHandler({
    loadIdentity: () => identity,
    saveFavoriteMeal,
    verifySession: () => session,
    ...overrides,
  });
}

function removeHandler() {
  return createRemoveFavoriteHandler(
    {
      loadIdentity: () => identity,
      removeFavoriteMeal,
      verifySession: () => session,
    },
    () => "22222222-2222-4222-8222-222222222222",
  );
}

describe("save favorite route handler", () => {
  it("saves a favorite for the signed-in member", async () => {
    saveFavoriteMeal.mockClear();
    const response = await saveHandler()(
      new Request("https://ordah.test/api/favorites", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "sec-fetch-site": "same-origin",
        },
        body: JSON.stringify({ menuItemId }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await readSuccessData(response)).toStrictEqual({
      favoriteId: "22222222-2222-4222-8222-222222222222",
      rank: 1,
    });
    expect(saveFavoriteMeal).toHaveBeenCalledWith({
      userId: identity.userId,
      menuItemId,
    });
  });

  it("rejects a malformed body", async () => {
    const response = await saveHandler()(
      new Request("https://ordah.test/api/favorites", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "sec-fetch-site": "same-origin",
        },
        body: JSON.stringify({ nope: true }),
      }),
    );
    expect(response.status).toBe(400);
    expect(await readFailureCode(response)).toBe("INVALID_INPUT");
  });

  it("maps a limit conflict to 409 with the public message", async () => {
    const response = await saveHandler({
      saveFavoriteMeal: vi.fn(() =>
        Promise.reject(
          new PublicApiError(
            "CONFLICT",
            "You already have 3 favorites here — remove one first.",
          ),
        ),
      ),
    })(
      new Request("https://ordah.test/api/favorites", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "sec-fetch-site": "same-origin",
        },
        body: JSON.stringify({ menuItemId }),
      }),
    );
    expect(response.status).toBe(409);
    const body = (await response.json()) as { error?: { message?: string } };
    expect(body.error?.message).toBe(
      "You already have 3 favorites here — remove one first.",
    );
  });

  it("requires a session", async () => {
    const response = await saveHandler({
      verifySession: () => {
        throw new PublicApiError("UNAUTHENTICATED", "Sign in is required.");
      },
    })(
      new Request("https://ordah.test/api/favorites", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "sec-fetch-site": "same-origin",
        },
        body: JSON.stringify({ menuItemId }),
      }),
    );
    expect(response.status).toBe(401);
  });

  it("rejects cross-site mutations", async () => {
    const response = await saveHandler()(
      new Request("https://ordah.test/api/favorites", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "sec-fetch-site": "cross-site",
        },
        body: JSON.stringify({ menuItemId }),
      }),
    );
    expect(response.status).toBe(403);
  });
});

describe("remove favorite route handler", () => {
  it("removes a favorite for the signed-in member", async () => {
    removeFavoriteMeal.mockClear();
    const response = await removeHandler()(
      new Request(
        "https://ordah.test/api/favorites/22222222-2222-4222-8222-222222222222",
        {
          method: "DELETE",
          headers: { "sec-fetch-site": "same-origin" },
        },
      ),
    );
    expect(response.status).toBe(200);
    expect(await readSuccessData(response)).toStrictEqual({ ok: true });
    expect(removeFavoriteMeal).toHaveBeenCalledWith({
      userId: identity.userId,
      favoriteId: parseId<FavoriteId>("22222222-2222-4222-8222-222222222222"),
    });
  });

  it("rejects an invalid favorite id", async () => {
    const handler = createRemoveFavoriteHandler(
      {
        loadIdentity: () => identity,
        removeFavoriteMeal,
        verifySession: () => session,
      },
      () => "not-a-valid-id",
    );
    const response = await handler(
      new Request("https://ordah.test/api/favorites/not-a-valid-id", {
        method: "DELETE",
        headers: { "sec-fetch-site": "same-origin" },
      }),
    );
    expect(response.status).toBe(400);
  });
});
