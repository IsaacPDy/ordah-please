import { render } from "@testing-library/react-native";

import HomeScreen from "../app/(member)/index";
import { memberTabs } from "../src/navigation/member-tabs";

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

  it("keeps every tab target at least 44 logical pixels high", () => {
    expect(memberTabs.every((tab) => tab.minimumTouchTarget >= 44)).toBe(true);
  });

  it("renders an honest empty home state without fake order data", async () => {
    const screen = await render(<HomeScreen />);

    expect(screen.getByText("ordah please")).toBeTruthy();
    expect(screen.getByRole("header", { name: "Your home" })).toBeTruthy();
    expect(screen.getByText("Nothing needs your attention yet")).toBeTruthy();
  });
});
