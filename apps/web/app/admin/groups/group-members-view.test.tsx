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
import { GroupMembersView } from "./group-members-view";
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const owner = {
  userId: "owner",
  displayName: "Alice",
  imageUrl: null,
  role: "owner" as const,
};
const member = {
  userId: "person",
  displayName: "Bob",
  imageUrl: null,
  role: "member" as const,
};
const props = {
  group: {
    id: "group",
    name: "Friends",
    archivedAt: null,
    members: [owner, member],
  },
  users: [
    { id: "new", displayName: "Cara" },
    { id: "person", displayName: "Bob" },
  ],
};
const fetchMock = vi.fn();
beforeEach(() => {
  refresh.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("admin group member cards", () => {
  it("shows cards and protects the owner from role/removal controls", () => {
    render(<GroupMembersView {...props} />);
    const ownerCard = screen.getByRole("article", { name: "Alice" });
    expect(within(ownerCard).getByText("Group Owner")).toBeTruthy();
    expect(within(ownerCard).queryByRole("button")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Appoint manager" }),
    ).toBeTruthy();
  });
  it("appoints a manager in the selected group and refreshes", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    render(<GroupMembersView {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Appoint manager" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/groups/group/members/person/role",
        expect.objectContaining({
          body: JSON.stringify({ expectedRole: "member", role: "manager" }),
        }),
      ),
    );
    expect(refresh).toHaveBeenCalled();
  });
  it("returns a Manager to Member", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    render(
      <GroupMembersView
        {...props}
        group={{
          ...props.group,
          members: [owner, { ...member, role: "manager" }],
        }}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Remove manager role" }),
    );
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ expectedRole: "manager", role: "member" }),
        }),
      ),
    );
  });
  it("adds an eligible person to this group without a group selector", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    render(<GroupMembersView {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Add people" }));
    expect(screen.queryByRole("option", { name: "Bob" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Person"), {
      target: { value: "new" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add to group" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/users/new/memberships",
        expect.objectContaining({ body: JSON.stringify({ groupId: "group" }) }),
      ),
    );
  });
  it("requires confirmation before removing a person", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    render(<GroupMembersView {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove from group" }));
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Remove",
      }),
    );
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/users/person/memberships/group/remove",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });
  it("shows safe errors and keeps archived groups read-only", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: () =>
        Promise.resolve({ error: { message: "Membership changed." } }),
    });
    const view = render(<GroupMembersView {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Appoint manager" }));
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Membership changed.",
    );
    expect(refresh).not.toHaveBeenCalled();
    view.rerender(
      <GroupMembersView
        {...props}
        group={{ ...props.group, archivedAt: new Date() }}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Appoint manager" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Add people" })).toBeNull();
  });
});
