import { render } from "@testing-library/react-native";
import { Text } from "react-native-paper";

import { MobileMemberAccessState } from "../src/features/access/member-access-state";

jest.mock("../src/auth/auth-client", () => ({
  getMobileAuthClient: () => {
    throw new Error("auth client not needed in this test");
  },
  readMobileApiUrl: () => "https://preview.ordah-please.test",
  readMobileSessionCookie: () => {
    throw new Error("auth client not needed in this test");
  },
}));

const grouplessIdentity = {
  displayName: "",
  email: "",
  imageUrl: null,
  isPlatformAdmin: false,
  memberships: [],
  pendingAdminRequestCount: 0,
} as const;

describe("MobileMemberAccessState", () => {
  it("keeps Home restaurant discovery and removes fake active orders", async () => {
    const screen = await render(
      <MobileMemberAccessState identity={grouplessIdentity} surface="home">
        <Text>Restaurants</Text>
      </MobileMemberAccessState>,
    );

    expect(screen.getByText("Restaurants")).toBeTruthy();
    expect(screen.queryByText("Friday lunch")).toBeNull();
  });

  it.each([
    ["orders", "No group orders yet"],
    ["groups", "You have not joined a group yet"],
  ] as const)("shows the honest %s empty state", async (surface, copy) => {
    const screen = await render(
      <MobileMemberAccessState identity={grouplessIdentity} surface={surface}>
        <Text>Prototype group data</Text>
      </MobileMemberAccessState>,
    );

    expect(screen.getByText(copy)).toBeTruthy();
    expect(screen.queryByText("Prototype group data")).toBeNull();
  });

  it("renders exact role labels for every real membership", async () => {
    const screen = await render(
      <MobileMemberAccessState
        identity={{
          ...grouplessIdentity,
          memberships: [
            { groupId: "group-a" as never, role: "group-owner" },
            { groupId: "group-b" as never, role: "manager" },
            { groupId: "group-c" as never, role: "member" },
          ],
        }}
        surface="groups"
      >
        <Text>Prototype group data</Text>
      </MobileMemberAccessState>,
    );

    expect(screen.getByText("Group Owner")).toBeTruthy();
    expect(screen.getByText("Manager")).toBeTruthy();
    expect(screen.getByText("Member")).toBeTruthy();
    expect(screen.getByText("group-a")).toBeTruthy();
  });
});
