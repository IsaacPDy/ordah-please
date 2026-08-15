// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AdminGroupsPage from "./page";

vi.mock("../../../src/features/groups/group-runtime", () => ({
  groupRuntime: {
    listAllGroupsForAdmin: vi.fn(() =>
      Promise.resolve([
        {
          groupId: "group-1",
          name: "Active Group",
          ownerDisplayName: "Alice",
          memberCount: 3,
        },
      ]),
    ),
    listAllUsers: vi.fn(() => Promise.resolve([])),
  },
}));

vi.mock("../../components/admin-page", () => ({
  AdminPage: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("../../components/create-group-dialog", () => ({
  CreateGroupDialog: () => <div data-testid="create-group-dialog" />,
}));

afterEach(cleanup);

describe("AdminGroupsPage", () => {
  it("renders the table header and one row per active group", async () => {
    render(await AdminGroupsPage());

    expect(await screen.findByText("Active Group")).toBeTruthy();
    expect(screen.getByText("Owner")).toBeTruthy();
    expect(screen.getByText("Actions")).toBeTruthy();
  });
});
