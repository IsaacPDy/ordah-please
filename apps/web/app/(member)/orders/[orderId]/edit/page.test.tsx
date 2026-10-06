// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import EditSessionPage from "./page";
const fixture = vi.hoisted(() => ({
  role: "manager",
  groupId: "group",
  listMembers: vi.fn(() => Promise.resolve([])),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("../../../../../src/auth/load-server-page-identity", () => ({
  getCurrentServerPageIdentity: () =>
    Promise.resolve({
      status: "authenticated",
      identity: {
        memberships: [{ groupId: fixture.groupId, role: fixture.role }],
      },
    }),
}));
vi.mock("@ordah-please/db", () => ({
  getRuntimeDatabase: () => ({}),
  createRepositories: () => ({
    orders: {
      findOrderDetail: () =>
        Promise.resolve({
          groupId: "group",
          groupName: "Friends",
          state: "ordered",
          selectedRestaurantId: null,
          initialRestaurantId: null,
          createdAt: new Date(),
          completedAt: null,
          managerUserId: "owner",
          deliveryAddressSnapshot: {},
          participants: [],
        }),
      listOrderLines: () => Promise.resolve([]),
    },
    groupAccess: { listActiveMembers: fixture.listMembers },
    catalog: { listRestaurants: () => Promise.resolve([]) },
  }),
}));
vi.mock("./session-log-editor", () => ({
  SessionLogEditor: () => <div>Session editor</div>,
}));
afterEach(() => {
  cleanup();
  fixture.groupId = "group";
  fixture.role = "manager";
  vi.clearAllMocks();
});
describe("session edit page authorization", () => {
  it.each(["group-owner", "manager"])(
    "opens the editor for a current %s",
    async (role) => {
      fixture.role = role;
      render(
        await EditSessionPage({
          params: Promise.resolve({ orderId: "order" }),
        }),
      );
      expect(screen.getByText("Session editor")).toBeTruthy();
    },
  );
  it.each([
    ["member", "group"],
    ["manager", "other-group"],
  ])("denies %s from %s before reading editor data", async (role, groupId) => {
    fixture.role = role;
    fixture.groupId = groupId;
    await expect(
      EditSessionPage({ params: Promise.resolve({ orderId: "order" }) }),
    ).rejects.toThrow("NOT_FOUND");
    expect(fixture.listMembers).not.toHaveBeenCalled();
  });
});
