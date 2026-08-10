import { render } from "@testing-library/react-native";
import { parseGroupDetailsResponse } from "@ordah-please/contracts";

import { GroupDetailsScreen } from "../src/features/groups/group-details-screen";

describe("GroupDetailsScreen", () => {
  it("renders the group name, viewer role, owner, and roster for a group-owner viewer", async () => {
    const details = parseGroupDetailsResponse({
      groupId: "group-1",
      name: "Friday Lunch Club",
      viewerRole: "group-owner",
      owner: { userId: "user-1", displayName: "Mia" },
      members: [
        { userId: "user-1", displayName: "Mia", role: "group-owner" },
        { userId: "user-2", displayName: "Sam", role: "member" },
      ],
    });

    const screen = await render(<GroupDetailsScreen details={details} />);

    expect(screen.getByText("Friday Lunch Club")).toBeTruthy();
    expect(screen.getByText("Group Owner view")).toBeTruthy();
    expect(screen.getByText("Owner")).toBeTruthy();
    expect(screen.getByText("Members")).toBeTruthy();
    expect(screen.getAllByText("Mia")).toHaveLength(2);
    expect(screen.getByText("Sam")).toBeTruthy();
  });

  it("renders the member-role label when the viewer is a member", async () => {
    const details = parseGroupDetailsResponse({
      groupId: "group-1",
      name: "Friday Lunch Club",
      viewerRole: "member",
      owner: { userId: "user-1", displayName: "Mia" },
      members: [
        { userId: "user-1", displayName: "Mia", role: "group-owner" },
        { userId: "user-2", displayName: "Sam", role: "member" },
      ],
    });

    const screen = await render(<GroupDetailsScreen details={details} />);

    expect(screen.getByText("Member view")).toBeTruthy();
  });
});
