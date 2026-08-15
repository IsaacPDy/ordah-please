// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UsersAdminView } from "./users-admin-view";
import type { AdminUserSummary } from "../../../src/features/users/users-runtime";

const mockRefresh = vi.fn();
const mockFetch = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

afterEach(cleanup);

const users: readonly AdminUserSummary[] = [
  {
    displayName: "Alice Admin",
    email: "alice@example.test",
    id: "user-alice",
    imageUrl: null,
    isPlatformAdmin: true,
    memberships: [
      {
        groupId: "group-friends",
        groupName: "Friends",
        role: "group-owner",
      },
    ],
  },
  {
    displayName: "Mia Member",
    email: "mia@example.test",
    id: "user-mia",
    imageUrl: "https://example.test/mia.png",
    isPlatformAdmin: false,
    memberships: [],
  },
  {
    displayName: "Jordan Diaz",
    email: "jordan@example.test",
    id: "user-jordan",
    imageUrl: null,
    isPlatformAdmin: false,
    memberships: [
      {
        groupId: "group-friends",
        groupName: "Friends",
        role: "member",
      },
      {
        groupId: "group-design",
        groupName: "Design team",
        role: "manager",
      },
    ],
  },
];

const groups = [
  { groupId: "group-friends", name: "Friends" },
  { groupId: "group-work", name: "Work" },
];

beforeEach(() => {
  mockRefresh.mockReset();
  mockFetch.mockReset();
  globalThis.fetch = mockFetch;
});

describe("UsersAdminView", () => {
  it("renders all users when search is empty and selects the first by default", () => {
    render(<UsersAdminView users={users} groups={groups} />);

    // Alice is selected by default, so her name appears in both the list row
    // and the detail header — getAllByText handles that.
    expect(screen.getAllByText("Alice Admin").length).toBeGreaterThan(0);
    expect(screen.getByText("Mia Member")).toBeTruthy();
    expect(screen.getByText("Jordan Diaz")).toBeTruthy();

    // First row (Alice) is selected; PA pill renders somewhere on the page.
    expect(screen.getAllByText("Platform Admin").length).toBeGreaterThan(0);
    const detail = screen.getByText("Group roles").parentElement!;
    expect(within(detail).getByText("Friends")).toBeTruthy();
    expect(within(detail).getByText("Group Owner")).toBeTruthy();
  });

  it("filters by name case-insensitively", () => {
    render(<UsersAdminView users={users} groups={groups} />);

    fireEvent.change(screen.getByLabelText("Search users"), {
      target: { value: "JOR" },
    });

    // Jordan becomes the auto-selected row, so the name appears twice.
    expect(screen.getAllByText("Jordan Diaz").length).toBeGreaterThan(0);
    expect(screen.queryByText("Alice Admin")).toBeNull();
    expect(screen.queryByText("Mia Member")).toBeNull();
  });

  it("filters by email case-insensitively", () => {
    render(<UsersAdminView users={users} groups={groups} />);

    fireEvent.change(screen.getByLabelText("Search users"), {
      target: { value: "MIA@" },
    });

    // Mia becomes the auto-selected row, so the name appears twice.
    expect(screen.getAllByText("Mia Member").length).toBeGreaterThan(0);
    expect(screen.queryByText("Alice Admin")).toBeNull();
  });

  it("shows the empty-result message when search matches nobody and falls back to a 'Select a user' detail state", () => {
    render(<UsersAdminView users={users} groups={groups} />);

    fireEvent.change(screen.getByLabelText("Search users"), {
      target: { value: "nobody" },
    });

    expect(screen.getByText(/No users match/)).toBeTruthy();
    expect(screen.getByText("Select a user.")).toBeTruthy();
  });

  it("auto-selects the first visible row when the current selection is filtered out", () => {
    render(<UsersAdminView users={users} groups={groups} />);

    // Alice is selected by default. Filter to Jordan.
    fireEvent.change(screen.getByLabelText("Search users"), {
      target: { value: "jordan" },
    });

    // Detail panel should now show Jordan, not Alice.
    const detail = screen.getByText("Group roles").parentElement!;
    expect(within(detail).getByText("Friends")).toBeTruthy();
    expect(within(detail).getByText("Design team")).toBeTruthy();
    expect(within(detail).getByText("Manager")).toBeTruthy();
  });

  it("renders initials fallback when imageUrl is null and an <img> when it is present", () => {
    const { container } = render(
      <UsersAdminView users={users} groups={groups} />,
    );

    // Alice (no image) → initials "A" appears in the list row AND the detail header.
    expect(screen.getAllByText("A").length).toBeGreaterThan(0);
    // Mia (has image) → at least one img tag in the document.
    expect(
      container.querySelector('img[src="https://example.test/mia.png"]'),
    ).toBeTruthy();
  });

  it("shows 'Not in any groups yet.' for a user with zero memberships", () => {
    render(<UsersAdminView users={users} groups={groups} />);

    // Select Mia (second row).
    fireEvent.click(screen.getByText("Mia Member"));

    expect(screen.getByText("Not in any groups yet.")).toBeTruthy();
  });

  it("opens the add-user-to-group dialog when the trigger is clicked", () => {
    render(<UsersAdminView users={users} groups={groups} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Add user to group" }),
    );

    expect(
      screen.getByRole("heading", { name: "Add user to group" }),
    ).toBeTruthy();
  });

  it("removes a membership and refreshes on confirm", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
    render(<UsersAdminView users={users} groups={groups} />);

    fireEvent.click(
      screen.getByRole("button", { name: /Remove from Friends/i }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/users/user-alice/memberships/group-friends/remove",
        { method: "POST" },
      );
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("surfaces a 409 error inline in the remove-membership dialog", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: () =>
        Promise.resolve({ error: { message: "Reassign ownership first." } }),
    });
    render(<UsersAdminView users={users} groups={groups} />);

    fireEvent.click(
      screen.getByRole("button", { name: /Remove from Friends/i }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));

    expect(
      await screen.findByText("Reassign ownership first."),
    ).toBeTruthy();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("opens the confirm-suspend dialog when Suspend is clicked", () => {
    render(<UsersAdminView users={users} groups={groups} />);

    fireEvent.click(
      screen.getByRole("button", { name: /Suspend account/i }),
    );

    expect(
      screen.getByRole("heading", { name: /Suspend Alice Admin\?/i }),
    ).toBeTruthy();
  });

  it("renders the empty state when there are zero users", () => {
    render(<UsersAdminView users={[]} groups={groups} />);

    expect(screen.getByText("No users yet.")).toBeTruthy();
    expect(screen.getByText("Select a user.")).toBeTruthy();
  });
});
