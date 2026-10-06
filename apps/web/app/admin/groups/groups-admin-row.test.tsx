// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GroupsAdminRow } from "./groups-admin-row";

const mockRefresh = vi.fn();
const mockFetch = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

afterEach(cleanup);

const group = {
  activeOrderCount: 2,
  groupId: "group-1",
  name: "Friends",
  ownerDisplayName: "Alice",
  memberCount: 4,
};

beforeEach(() => {
  mockRefresh.mockReset();
  mockFetch.mockReset();
  globalThis.fetch = mockFetch;
});

describe("GroupsAdminRow", () => {
  it("renders the group name, owner, and member count", () => {
    render(<GroupsAdminRow group={group} />);

    expect(
      screen.getByRole("link", { name: "Friends" }).getAttribute("href"),
    ).toBe("/admin/groups/group-1");
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("opens the rename dialog prefilled and submits a rename", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });
    render(<GroupsAdminRow group={group} />);

    fireEvent.click(screen.getByRole("button", { name: /Rename/i }));
    const input = await screen.findByDisplayValue("Friends");
    fireEvent.change(input, { target: { value: "Best Friends" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/groups/group-1/rename",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ name: "Best Friends" }),
        }),
      );
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("warns before permanent group deletion and submits", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });
    render(<GroupsAdminRow group={group} />);

    fireEvent.click(screen.getByRole("button", { name: /^Delete$/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/This cannot be undone/)).toBeTruthy();
    expect(mockFetch).not.toHaveBeenCalled();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete group permanently" }),
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/groups/group-1/delete",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ confirmed: true }),
        }),
      );
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("surfaces a 409 inline in the rename dialog", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: () => Promise.resolve({ error: { message: "Group is archived." } }),
    });
    render(<GroupsAdminRow group={group} />);

    fireEvent.click(screen.getByRole("button", { name: /Rename/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Save" }));

    expect(await screen.findByText("Group is archived.")).toBeTruthy();
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});
