import { render } from "@testing-library/react-native";

import RootLayout from "../app/_layout";

const mockUseFonts = jest.fn<
  [boolean, Error | null],
  [Readonly<Record<string, number>>]
>();
jest.mock("expo-font", () => ({
  useFonts: (fontMap: Readonly<Record<string, number>>) =>
    mockUseFonts(fontMap),
}));

jest.mock("expo-router", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");

  return {
    Stack: () => React.createElement(View, { testID: "mobile-navigation" }),
  };
});

describe("RootLayout", () => {
  beforeEach(() => {
    mockUseFonts.mockReset();
  });

  it("waits while bundled fonts are still loading", async () => {
    mockUseFonts.mockReturnValue([false, null]);

    const screen = await render(<RootLayout />);

    expect(screen.queryByTestId("mobile-navigation")).toBeNull();
  });

  it("renders with platform fallback fonts when bundled font loading fails", async () => {
    mockUseFonts.mockReturnValue([false, new Error("Font asset unavailable")]);

    const screen = await render(<RootLayout />);

    expect(screen.getByTestId("mobile-navigation")).toBeTruthy();
  });
});
