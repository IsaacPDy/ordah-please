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

  it("renders the approved active-order and restaurant Home sections", async () => {
    const screen = await render(<HomeScreen />);

    expect(screen.getByText("ordah please")).toBeTruthy();
    expect(screen.getByText("Active group order")).toBeTruthy();
    expect(screen.getByRole("header", { name: "Friday lunch" })).toBeTruthy();
    expect(screen.getByText("Choose restaurant")).toBeTruthy();
    expect(screen.getByRole("header", { name: "Restaurants" })).toBeTruthy();
    expect(screen.getByTestId("member-safe-area").props.edges).toEqual(
      expect.objectContaining({ bottom: "off", top: "additive" }),
    );
  });

  it("renders native Orders sections", async () => {
    const screen = await render(<OrdersScreen />);

    expect(screen.getByRole("header", { name: "Active orders" })).toBeTruthy();
    expect(screen.getByRole("header", { name: "Order history" })).toBeTruthy();
    expect(screen.getByText("Friday lunch")).toBeTruthy();
  });

  it("renders ranked native Favorites", async () => {
    const screen = await render(<FavoritesScreen />);

    expect(screen.getByText("Green Table · BGC")).toBeTruthy();
    expect(screen.getByText("Rank 1")).toBeTruthy();
    expect(screen.getByText("Remove restaurant favorites")).toBeTruthy();
  });

  it("renders multiple native groups and their roles", async () => {
    const screen = await render(<TeamScreen />);

    expect(screen.getByRole("header", { name: "Your groups" })).toBeTruthy();
    expect(screen.getByText("Friends")).toBeTruthy();
    expect(screen.getByText("Design team")).toBeTruthy();
    expect(screen.getByText("Group Owner")).toBeTruthy();
  });
});
