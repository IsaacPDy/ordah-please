import { Buffer } from "node:buffer";

import { verifyWebhook } from "@clerk/backend/webhooks";
import { Webhook } from "standardwebhooks";
import { describe, expect, it } from "vitest";

import { createClerkWebhookHandler, POST } from "./route";

describe("Clerk webhook route", () => {
  it("exports the production POST Route Handler", () => {
    expect(POST).toBeTypeOf("function");
  });

  it("rejects a forged webhook without leaking verifier details", async () => {
    let synchronizationStarted = false;
    const handler = createClerkWebhookHandler({
      syncAccount: () => {
        synchronizationStarted = true;
        return Promise.resolve({ status: "applied" as const });
      },
      verifyWebhook: () =>
        Promise.reject(new Error("signature and signing secret details")),
    });

    const response = await handler(
      new Request("https://example.test/api/webhooks/clerk", {
        body: "{}",
        method: "POST",
      }),
    );

    expect(synchronizationStarted).toBe(false);
    expect(response.status).toBe(400);
    const body: unknown = await response.json();
    expect(body).toEqual({
      error: {
        code: "INVALID_INPUT",
        message: "Invalid webhook request.",
      },
      ok: false,
    });
    expect(JSON.stringify(body)).not.toContain("secret");
  });

  it("maps a verified user event into one account synchronization", async () => {
    let synchronizedEvent: unknown;
    const handler = createClerkWebhookHandler({
      syncAccount: (event) => {
        synchronizedEvent = event;
        return Promise.resolve({ status: "applied" as const });
      },
      verifyWebhook: () =>
        Promise.resolve({
          data: {
            first_name: "Avery",
            id: "user_clerk_123",
            last_name: "Rivera",
            updated_at: 1_774_505_600_000,
            username: "avery",
          },
          type: "user.created",
        }),
    });
    const request = new Request("https://example.test/api/webhooks/clerk", {
      body: "{}",
      headers: {
        "webhook-id": "evt_created",
        "webhook-timestamp": "1774505600",
      },
      method: "POST",
    });

    const response = await handler(request);

    expect(synchronizedEvent).toEqual({
      clerkUserId: "user_clerk_123",
      displayName: "Avery Rivera",
      eventId: "evt_created",
      occurredAt: new Date(1_774_505_600_000),
      type: "user.created",
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { status: "applied" },
      ok: true,
    });
  });

  it("maps a verified deletion using the signed webhook timestamp", async () => {
    let synchronizedEvent: unknown;
    const handler = createClerkWebhookHandler({
      syncAccount: (event) => {
        synchronizedEvent = event;
        return Promise.resolve({ status: "applied" as const });
      },
      verifyWebhook: () =>
        Promise.resolve({
          data: {
            id: "user_clerk_123",
          },
          type: "user.deleted",
        }),
    });
    const request = new Request("https://example.test/api/webhooks/clerk", {
      body: "{}",
      headers: {
        "webhook-id": "evt_deleted",
        "webhook-timestamp": "1774509200",
      },
      method: "POST",
    });

    const response = await handler(request);

    expect(synchronizedEvent).toEqual({
      clerkUserId: "user_clerk_123",
      eventId: "evt_deleted",
      occurredAt: new Date(1_774_509_200_000),
      type: "user.deleted",
    });
    expect(response.status).toBe(200);
  });

  it("accepts a real Clerk signature and rejects an altered signature", async () => {
    const signingSecret = Buffer.from(
      "synthetic-clerk-webhook-test-key",
    ).toString("base64");
    const payload = JSON.stringify({
      data: {
        first_name: "Avery",
        id: "user_clerk_signed",
        last_name: "Rivera",
        updated_at: Date.now(),
      },
      type: "user.updated",
    });
    const eventId = "evt_signed";
    const timestamp = new Date();
    const timestampHeader = String(Math.floor(timestamp.getTime() / 1_000));
    const signature = new Webhook(signingSecret).sign(
      eventId,
      timestamp,
      payload,
    );
    let synchronizationRuns = 0;
    const handler = createClerkWebhookHandler({
      syncAccount: () => {
        synchronizationRuns += 1;
        return Promise.resolve({ status: "applied" as const });
      },
      verifyWebhook: (request) => verifyWebhook(request, { signingSecret }),
    });

    const signedResponse = await handler(
      new Request("https://example.test/api/webhooks/clerk", {
        body: payload,
        headers: {
          "svix-id": eventId,
          "svix-signature": signature,
          "svix-timestamp": timestampHeader,
        },
        method: "POST",
      }),
    );
    const forgedResponse = await handler(
      new Request("https://example.test/api/webhooks/clerk", {
        body: payload,
        headers: {
          "svix-id": eventId,
          "svix-signature": "v1,altered",
          "svix-timestamp": timestampHeader,
        },
        method: "POST",
      }),
    );

    expect(signedResponse.status).toBe(200);
    expect(forgedResponse.status).toBe(400);
    expect(synchronizationRuns).toBe(1);
  });

  it("rejects a malformed verified user payload with the safe 400 envelope", async () => {
    const handler = createClerkWebhookHandler({
      syncAccount: () => {
        throw new Error("malformed payload must not synchronize");
      },
      verifyWebhook: () =>
        Promise.resolve({
          data: { updated_at: Date.now() },
          type: "user.created",
        }),
    });

    const response = await handler(
      new Request("https://example.test/api/webhooks/clerk", {
        body: "{}",
        headers: { "svix-id": "evt_malformed" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INVALID_INPUT",
        message: "Invalid webhook request.",
      },
      ok: false,
    });
  });

  it("returns a retryable safe 500 when account synchronization fails", async () => {
    const handler = createClerkWebhookHandler({
      syncAccount: () =>
        Promise.reject(new Error("SQL and database credential details")),
      verifyWebhook: () =>
        Promise.resolve({
          data: {
            first_name: "Avery",
            id: "user_clerk_123",
            last_name: "Rivera",
            updated_at: Date.now(),
          },
          type: "user.updated",
        }),
    });

    const response = await handler(
      new Request("https://example.test/api/webhooks/clerk", {
        body: "{}",
        headers: { "svix-id": "evt_failure" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(500);
    const body: unknown = await response.json();
    expect(body).toEqual({
      error: {
        code: "INTERNAL_FAILURE",
        message: "Something went wrong.",
      },
      ok: false,
    });
    expect(JSON.stringify(body)).not.toContain("credential");
  });
});
