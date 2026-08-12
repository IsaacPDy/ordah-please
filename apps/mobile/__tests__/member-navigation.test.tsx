import { render } from "@testing-library/react-native";
import { designTokens } from "@ordah-please/ui";

import HomeScreen from "../app/(member)/index";
import FavoritesScreen from "../app/(member)/favorites";
import OrdersScreen from "../app/(member)/orders";
import TeamScreen from "../app/(member)/team";
import {
  memberTabActiveColor,
  memberTabBarStyle,
  memberTabItemStyle,
  memberTabs,
} from "../src/navigation/member-tabs";
import { MobileAppIdentityProvider } from "../src/features/access/mobile-member-gate";

jest.mock("expo-router", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    Link: (props: { children: React.ReactNode }) =>
      React.createElement(View, { testID: "expo-link" }, props.children),
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  };
});

jest.mock("../src/auth/auth-client", () => ({
  getMobileAuthClient: () => {
    throw new Error("no session in test");
  },
  readMobileApiUrl: () => "https://preview.ordah-please.test",
  readMobileSessionCookie: () => {
    throw new Error("no session in test");
  },
}));

describe("member navigation", () => {
  it("provides the four approved member tabs with accessible names", () => {
    expect(memberTabs).toEqual([
      expect.objectContaining({
        accessibilityLabel: "Home tab",
        href: "/",
        label: "Home",
      }),
      expect.objectContaining({
        accessibilityLabel: "Orders tab",
        href: "/orders",
        label: "Orders",
      }),
      expect.objectContaining({
        accessibilityLabel: "Favorites tab",
        href: "/favorites",
        label: "Favorites",
      }),
      expect.objectContaining({
        accessibilityLabel: "Groups tab",
        href: "/groups",
        label: "Groups",
      }),
    ]);
  });

  it("connects the rendered tab style to the approved touch target", () => {
    expect(memberTabItemStyle.minHeight).toBe(designTokens.touchTarget.minimum);
    expect(memberTabItemStyle.minWidth).toBe(designTokens.touchTarget.minimum);
  });

  it("uses an accessible active color without replacing the bottom inset", () => {
    expect(memberTabActiveColor).toBe(designTokens.colors.primaryStrong);
    expect(memberTabBarStyle).not.toHaveProperty("paddingBottom");
  });

  it("keeps restaurant discovery and removes fake orders for a groupless account", async () => {
    const screen = await render(<HomeScreen />);

    expect(screen.getByText("ordah please")).toBeTruthy();
    expect(screen.queryByText("Active group order")).toBeNull();
    expect(screen.queryByRole("header", { name: "Friday lunch" })).toBeNull();
    expect(screen.getByRole("header", { name: "Restaurants" })).toBeTruthy();
    expect(screen.getByTestId("member-safe-area").props.edges).toEqual(
      expect.objectContaining({ bottom: "off", top: "additive" }),
    );
  });

  it("renders the honest groupless Orders state", async () => {
    const screen = await render(<OrdersScreen />);

    expect(screen.getByText("No group orders yet")).toBeTruthy();
    expect(screen.queryByText("Friday lunch")).toBeNull();
  });

  it("renders ranked native Favorites", async () => {
    const screen = await render(<FavoritesScreen />);

    expect(screen.getByText("Green Table · BGC")).toBeTruthy();
    expect(screen.getByText("Rank 1")).toBeTruthy();
    expect(screen.getByText("Remove restaurant favorites")).toBeTruthy();
  });

  it("renders the honest groupless Groups state", async () => {
    const screen = await render(<TeamScreen />);

    expect(screen.getByText("You have not joined a group yet")).toBeTruthy();
  });

  it("renders every backend membership with its exact role label", async () => {
    const screen = await render(
      <MobileAppIdentityProvider
        identity={{
          displayName: "",
          email: "",
          imageUrl: null,
          isPlatformAdmin: false,
          memberships: [
            { groupId: "group-a" as never, role: "group-owner" },
            { groupId: "group-b" as never, role: "manager" },
            { groupId: "group-c" as never, role: "member" },
          ],
          pendingAdminRequestCount: 0,
        }}
      >
        <TeamScreen />
      </MobileAppIdentityProvider>,
    );

    expect(screen.getByRole("header", { name: "Your groups" })).toBeTruthy();
    expect(screen.getByText("group-a")).toBeTruthy();
    expect(screen.getByText("Group Owner")).toBeTruthy();
    expect(screen.getByText("Manager")).toBeTruthy();
    expect(screen.getByText("Member")).toBeTruthy();
  });
});
