// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  parseId,
  type GroupId,
  type UserId,
  type GroupDetails,
} from "@ordah-please/domain";
import { GroupDetailsView } from "./group-details-view";
const ownerId = parseId<UserId>("owner");
const details: GroupDetails = {
  groupId: parseId<GroupId>("group"),
  name: "Friends",
  viewerRole: "member",
  owner: { userId: ownerId, displayName: "Mia" },
  members: [{ userId: ownerId, displayName: "Mia", role: "group-owner" }],
  inviteLink: {
    publicValue: "https://example.test/invite/test",
    tokenPrefix: "test",
  },
};
afterEach(cleanup);
describe("group reference sections", () => {
  it("keeps owner management actions hidden from members in every section", () => {
    render(
      <GroupDetailsView
        details={details}
        canManage={false}
        canStartOrder={false}
      />,
    );
    expect(
      screen.queryByRole("link", { name: "Start a new order" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Members" }));
    expect(screen.getByText("Mia")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Copy invite link" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Rename group" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    expect(
      screen.getByRole("region", { name: "Group order history" }),
    ).toBeTruthy();
  });
  it("lets a manager start setup without exposing owner-only actions", () => {
    render(
      <GroupDetailsView
        details={{ ...details, viewerRole: "manager" }}
        canManage={false}
        canStartOrder
      />,
    );
    expect(
      screen
        .getByRole("link", { name: "Start a new order" })
        .getAttribute("href"),
    ).toBe("/orders/new?groupId=group");
    fireEvent.click(screen.getByRole("button", { name: "Members" }));
    expect(screen.queryByRole("button", { name: "Rotate link" })).toBeNull();
  });
});
