import { describe, expect, it, vi } from "vitest";

import type { ProductIdentityRow } from "@ordah-please/db";

import { loadAppIdentity } from "./load-app-identity";

const AUTH_USER_ID = "10000000-0000-4000-8000-000000000001";
const timestamp = new Date("2026-07-29T04:00:00.000Z");
const authIdentity = {
  authUserId: AUTH_USER_ID,
  displayName: "Avery",
  email: "avery@example.com",
  imageUrl: null,
};
const user: ProductIdentityRow["user"] = {
  archivedAt: null,
  authUserId: AUTH_USER_ID,
  createdAt: timestamp,
  displayName: "Avery",
  id: "internal-user-1",
  isPlatformAdmin: false,
  updatedAt: timestamp,
};

/** Supplies controllable persistence calls so identity freshness and writes can be asserted. */
function createIdentityReader() {
  return {
    ensureUserForAuthIdentity: vi.fn(() => Promise.resolve(user)),
    findIdentityByAuthUserId: vi.fn(
      (): Promise<ProductIdentityRow | undefined> =>
        Promise.resolve({
          user,
          memberships: [] as {
            groupId: string;
            role: "owner" | "manager" | "member";
          }[],
        }),
    ),
    listActiveMemberships: vi.fn(() => Promise.resolve([])),
  };
}

describe("loadAppIdentity", () => {
  it("loads an unchanged identity and memberships without writing or a separate membership read", async () => {
    const repository = createIdentityReader();
    const result = await loadAppIdentity(authIdentity, repository);

    expect(result).toEqual({
      ...authIdentity,
      isPlatformAdmin: false,
      memberships: [],
      userId: user.id,
    });
    expect(repository.findIdentityByAuthUserId).toHaveBeenCalledExactlyOnceWith(
      AUTH_USER_ID,
    );
    expect(repository.ensureUserForAuthIdentity).not.toHaveBeenCalled();
    expect(repository.listActiveMemberships).not.toHaveBeenCalled();
  });

  it("provisions a groupless product user on the first authenticated request", async () => {
    const repository = createIdentityReader();
    repository.findIdentityByAuthUserId.mockResolvedValueOnce(undefined);

    await expect(
      loadAppIdentity(authIdentity, repository),
    ).resolves.toMatchObject({
      memberships: [],
      userId: user.id,
    });
    expect(
      repository.ensureUserForAuthIdentity,
    ).toHaveBeenCalledExactlyOnceWith(authIdentity);
    expect(repository.findIdentityByAuthUserId).toHaveBeenCalledTimes(2);
  });

  it("rejects archived users before writing even when the auth profile has changed", async () => {
    const repository = createIdentityReader();
    repository.findIdentityByAuthUserId.mockResolvedValue({
      user: { ...user, archivedAt: timestamp },
      memberships: [],
    });

    await expect(
      loadAppIdentity({ ...authIdentity, displayName: "New Name" }, repository),
    ).rejects.toMatchObject({
      code: "UNAVAILABLE",
      message: "Your account is not available.",
    });
    expect(repository.ensureUserForAuthIdentity).not.toHaveBeenCalled();
  });

  it("loads current roles and account flags again on the next request", async () => {
    const repository = createIdentityReader();
    repository.findIdentityByAuthUserId.mockResolvedValueOnce({
      user: { ...user, isPlatformAdmin: true },
      memberships: [
        { groupId: "group-2", role: "member" },
        { groupId: "group-1", role: "owner" },
      ],
    });

    const first = await loadAppIdentity(authIdentity, repository);
    const second = await loadAppIdentity(authIdentity, repository);

    expect(first).toMatchObject({
      isPlatformAdmin: true,
      memberships: [
        { groupId: "group-1", role: "group-owner" },
        { groupId: "group-2", role: "member" },
      ],
    });
    expect(second).toMatchObject({ isPlatformAdmin: false, memberships: [] });
    expect(repository.findIdentityByAuthUserId).toHaveBeenCalledTimes(2);
    expect(repository.ensureUserForAuthIdentity).not.toHaveBeenCalled();
  });

  it("synchronizes a changed display name only, then re-reads current permissions", async () => {
    const repository = createIdentityReader();
    repository.findIdentityByAuthUserId.mockResolvedValueOnce({
      user: { ...user, displayName: "Previous Name" },
      memberships: [],
    });
    repository.findIdentityByAuthUserId.mockResolvedValueOnce({
      user,
      memberships: [{ groupId: "group-1", role: "manager" }],
    });

    await expect(
      loadAppIdentity(authIdentity, repository),
    ).resolves.toMatchObject({
      displayName: "Avery",
      memberships: [{ groupId: "group-1", role: "manager" }],
    });
    expect(repository.ensureUserForAuthIdentity).toHaveBeenCalledTimes(1);
    expect(repository.findIdentityByAuthUserId).toHaveBeenCalledTimes(2);
  });

  it("rejects an identity archived during profile synchronization", async () => {
    const repository = createIdentityReader();
    repository.findIdentityByAuthUserId.mockResolvedValueOnce({
      user: { ...user, displayName: "Previous Name" },
      memberships: [],
    });
    repository.findIdentityByAuthUserId.mockResolvedValueOnce({
      user: { ...user, archivedAt: timestamp },
      memberships: [],
    });

    await expect(
      loadAppIdentity(authIdentity, repository),
    ).rejects.toMatchObject({ code: "UNAVAILABLE" });
  });

  it("surfaces trusted auth profile fields without persisting email or image", async () => {
    const repository = createIdentityReader();
    const result = await loadAppIdentity(
      {
        ...authIdentity,
        email: "changed@example.test",
        imageUrl: "https://example.test/avatar.jpg",
      },
      repository,
    );

    expect(result).toMatchObject({
      email: "changed@example.test",
      imageUrl: "https://example.test/avatar.jpg",
    });
    expect(repository.ensureUserForAuthIdentity).not.toHaveBeenCalled();
  });
});
