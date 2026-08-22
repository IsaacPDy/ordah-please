import { describe, expect, it, vi } from "vitest";

vi.mock("./orders-runtime", () => ({
  ordersRuntime: {},
}));

import { PublicApiError } from "@ordah-please/contracts";
import { parseId, type GroupId, type OrderId, type UserId } from "@ordah-please/domain";

import type { AppIdentity } from "../../auth/load-app-identity";
import type { VerifiedSession } from "../../auth/verify-session";
import {
  createCompleteOrderHandler,
  createCreateOrderHandler,
} from "./orders-route-handlers";

const session: VerifiedSession = {
  authUserId: "auth-1",
  displayName: "Mia",
  email: "mia@example.com",
  imageUrl: null,
};

const identity: AppIdentity = {
  ...session,
  isPlatformAdmin: false,
  memberships: [
    {
      groupId: parseId<GroupId>("55555555-5555-4555-8555-555555555555"),
      role: "manager",
    },
  ],
  userId: parseId<UserId>("11111111-1111-4111-8111-111111111111"),
};

const createRequest = {
  deliveryAddress: {
    city: "Naga",
    lineOne: "12 Sample Street",
    lineTwo: null,
    notes: null,
    phoneNumber: "+63 900 000 0000",
    postalCode: null,
    recipientName: "Mia Tan",
  },
  foodDeadline: "2026-08-20T09:00:00.000Z",
  groupId: "55555555-5555-4555-8555-555555555555",
  initialBranchId: "77777777-7777-4777-8777-777777777777",
  initialRestaurantId: "66666666-6666-4666-8666-666666666666",
  participantUserIds: [],
  restaurantDeadline: null,
  saveAsGroupDefault: false,
  shortlistRestaurantIds: [],
  votingMode: "voting_disabled",
};

const createGroupOrder = vi.fn(() =>
  Promise.resolve({
    orderId: parseId<OrderId>("99999999-9999-4999-8999-999999999999"),
  }),
);
const completeOrder = vi.fn(() => Promise.resolve({ ok: true } as const));

async function readFailureCode(response: Response): Promise<string> {
  const body = (await response.json()) as { error?: { code?: string } };
  return body.error?.code ?? "none";
}

describe("create order route handler", () => {
  it("creates an order for the signed-in manager", async () => {
    const handler = createCreateOrderHandler({
      createGroupOrder,
      loadIdentity: () => identity,
      verifySession: () => session,
    });
    const response = await handler(
      new Request("https://ordah.test/api/orders", {
        body: JSON.stringify(createRequest),
        headers: {
          "content-type": "application/json",
          "sec-fetch-site": "same-origin",
        },
        method: "POST",
      }),
    );
    expect(response.status).toBe(200);
    expect(createGroupOrder).toHaveBeenCalledWith(
      expect.objectContaining({ identity }),
    );
  });

  it("rejects a malformed body with INVALID_INPUT", async () => {
    const handler = createCreateOrderHandler({
      createGroupOrder,
      loadIdentity: () => identity,
      verifySession: () => session,
    });
    const response = await handler(
      new Request("https://ordah.test/api/orders", {
        body: JSON.stringify({ nope: true }),
        headers: {
          "content-type": "application/json",
          "sec-fetch-site": "same-origin",
        },
        method: "POST",
      }),
    );
    expect(response.status).toBe(400);
    expect(await readFailureCode(response)).toBe("INVALID_INPUT");
  });

  it("maps a forbidden creator to 403", async () => {
    const handler = createCreateOrderHandler({
      createGroupOrder: vi.fn(() =>
        Promise.reject(new PublicApiError("FORBIDDEN", "Nope")),
      ),
      loadIdentity: () => identity,
      verifySession: () => session,
    });
    const response = await handler(
      new Request("https://ordah.test/api/orders", {
        body: JSON.stringify(createRequest),
        headers: {
          "content-type": "application/json",
          "sec-fetch-site": "same-origin",
        },
        method: "POST",
      }),
    );
    expect(response.status).toBe(403);
  });

  it("rejects cross-site mutations", async () => {
    const createGroupOrder = vi.fn();
    const handler = createCreateOrderHandler({
      createGroupOrder,
      loadIdentity: () => identity,
      verifySession: () => session,
    });
    const response = await handler(
      new Request("https://ordah.test/api/orders", {
        body: JSON.stringify(createRequest),
        headers: {
          "content-type": "application/json",
          "sec-fetch-site": "cross-site",
        },
        method: "POST",
      }),
    );
    expect(response.status).toBe(403);
    expect(createGroupOrder).not.toHaveBeenCalled();
  });

  it("rejects an origin mismatch", async () => {
    const createGroupOrder = vi.fn();
    const handler = createCreateOrderHandler({
      createGroupOrder,
      loadIdentity: () => identity,
      verifySession: () => session,
    });
    const response = await handler(
      new Request("https://ordah.test/api/orders", {
        body: JSON.stringify(createRequest),
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example",
          "sec-fetch-site": "same-origin",
        },
        method: "POST",
      }),
    );
    expect(response.status).toBe(403);
    expect(createGroupOrder).not.toHaveBeenCalled();
  });

  it("requires a session", async () => {
    const createGroupOrder = vi.fn();
    const handler = createCreateOrderHandler({
      createGroupOrder,
      loadIdentity: () => identity,
      verifySession: () => {
        throw new PublicApiError("UNAUTHENTICATED", "Sign in is required.");
      },
    });
    const response = await handler(
      new Request("https://ordah.test/api/orders", {
        body: JSON.stringify(createRequest),
        headers: {
          "content-type": "application/json",
          "sec-fetch-site": "same-origin",
        },
        method: "POST",
      }),
    );
    expect(response.status).toBe(401);
    expect(createGroupOrder).not.toHaveBeenCalled();
  });
});

describe("complete order route handler", () => {
  it("completes an order from its URL parameter", async () => {
    const handler = createCompleteOrderHandler(
      {
        completeOrder,
        loadIdentity: () => identity,
        verifySession: () => session,
      },
      () => "99999999-9999-4999-8999-999999999999",
    );
    const response = await handler(
      new Request("https://ordah.test/api/orders/9/complete", {
        body: JSON.stringify({ result: "cancelled" }),
        headers: {
          "content-type": "application/json",
          "sec-fetch-site": "same-origin",
        },
        method: "POST",
      }),
    );
    expect(response.status).toBe(200);
    expect(completeOrder).toHaveBeenCalledWith(
      expect.objectContaining({ result: "cancelled" }),
    );
  });

  it("rejects an invalid order id parameter", async () => {
    const handler = createCompleteOrderHandler(
      {
        completeOrder,
        loadIdentity: () => identity,
        verifySession: () => session,
      },
      () => "not-a-uuid",
    );
    const response = await handler(
      new Request("https://ordah.test/api/orders/9/complete", {
        body: JSON.stringify({ result: "cancelled" }),
        headers: {
          "content-type": "application/json",
          "sec-fetch-site": "same-origin",
        },
        method: "POST",
      }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects an unsupported completion result with INVALID_INPUT", async () => {
    const handler = createCompleteOrderHandler(
      {
        completeOrder,
        loadIdentity: () => identity,
        verifySession: () => session,
      },
      () => "99999999-9999-4999-8999-999999999999",
    );
    const response = await handler(
      new Request("https://ordah.test/api/orders/9/complete", {
        body: JSON.stringify({ result: "deleted" }),
        headers: {
          "content-type": "application/json",
          "sec-fetch-site": "same-origin",
        },
        method: "POST",
      }),
    );
    expect(response.status).toBe(400);
    expect(await readFailureCode(response)).toBe("INVALID_INPUT");
  });
});
