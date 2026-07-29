import { describe, expect, it, vi } from "vitest";

import {
  AUTH_IDENTITY_LINK_CONFIRMATION,
  linkAuthIdentity,
  readAuthIdentityLinkGuard,
} from "./link-auth-identity.js";

const AUTH_USER_ID = "10000000-0000-4000-8000-000000000001";
const PRODUCT_USER_ID = "20000000-0000-4000-8000-000000000001";

describe("development auth identity linking", () => {
  it("requires development and the explicit confirmation phrase", () => {
    expect(() =>
      readAuthIdentityLinkGuard({
        DATABASE_IDENTITY_LINK_CONFIRMATION: AUTH_IDENTITY_LINK_CONFIRMATION,
        NODE_ENV: "production",
      }),
    ).toThrowError("Auth identity linking requires NODE_ENV=development.");
    expect(() =>
      readAuthIdentityLinkGuard({ NODE_ENV: "development" }),
    ).toThrowError(
      "DATABASE_IDENTITY_LINK_CONFIRMATION must explicitly allow development linking.",
    );
  });

  it("links one unlinked product user and appends an audit event", async () => {
    const sequence: string[] = [];
    const operations = {
      appendAudit: vi.fn(() => {
        sequence.push("audit");
        return Promise.resolve();
      }),
      findAuthUser: vi.fn(() => Promise.resolve({ id: AUTH_USER_ID })),
      findProductUser: vi.fn(() =>
        Promise.resolve({
          archivedAt: null,
          authUserId: null,
          id: PRODUCT_USER_ID,
        }),
      ),
      findProductUserByAuthUserId: vi.fn(() => Promise.resolve(undefined)),
      linkProductUser: vi.fn(() => {
        sequence.push("link");
        return Promise.resolve();
      }),
    };

    await expect(
      linkAuthIdentity(
        { authUserId: AUTH_USER_ID, productUserId: PRODUCT_USER_ID },
        operations,
      ),
    ).resolves.toEqual({ linked: true });
    expect(sequence).toEqual(["link", "audit"]);
    expect(operations.appendAudit).toHaveBeenCalledWith({
      action: "identity.auth_linked",
      resourceId: PRODUCT_USER_ID,
      resourceType: "user",
    });
  });

  it("rejects archived and duplicate product links before writing", async () => {
    let productUser: {
      archivedAt: Date | null;
      authUserId: string | null;
      id: string;
    } = {
      archivedAt: new Date("2026-07-29T00:00:00.000Z"),
      authUserId: null,
      id: PRODUCT_USER_ID,
    };
    const operations = {
      appendAudit: vi.fn(() => Promise.resolve()),
      findAuthUser: vi.fn(() => Promise.resolve({ id: AUTH_USER_ID })),
      findProductUser: vi.fn(() => Promise.resolve(productUser)),
      findProductUserByAuthUserId: vi.fn(() => Promise.resolve(undefined)),
      linkProductUser: vi.fn(() => Promise.resolve()),
    };

    await expect(
      linkAuthIdentity(
        { authUserId: AUTH_USER_ID, productUserId: PRODUCT_USER_ID },
        operations,
      ),
    ).rejects.toThrowError("The product user is archived.");
    expect(operations.linkProductUser).not.toHaveBeenCalled();

    productUser = {
      archivedAt: null,
      authUserId: "30000000-0000-4000-8000-000000000001",
      id: PRODUCT_USER_ID,
    };
    await expect(
      linkAuthIdentity(
        { authUserId: AUTH_USER_ID, productUserId: PRODUCT_USER_ID },
        operations,
      ),
    ).rejects.toThrowError("The product user already has an auth identity.");
    expect(operations.linkProductUser).not.toHaveBeenCalled();
  });
});
