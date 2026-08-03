import { render } from "@testing-library/react-native";
import { designTokens } from "@ordah-please/ui";

import HomeScreen from "../app/(member)/index";
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
        accessibilityLabel: "Team tab",
        href: "/team",
        label: "Team",
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

  it("renders an honest empty home state without fake order data", async () => {
    const screen = await render(<HomeScreen />);

    expect(screen.getByText("ordah please")).toBeTruthy();
    expect(screen.getByRole("header", { name: "Your home" })).toBeTruthy();
    expect(screen.getByText("Nothing needs your attention yet")).toBeTruthy();
    expect(screen.getByTestId("member-safe-area").props.edges).toEqual(
      expect.objectContaining({ bottom: "off", top: "additive" }),
    );
  });
});
