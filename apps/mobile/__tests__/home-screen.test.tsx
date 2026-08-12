import { fireEvent, render } from "@testing-library/react-native";

import HomeScreen from "../app/(member)/index";

const mockPush = jest.fn();

jest.mock("expo-router", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    Link: (props: { children: React.ReactNode }) =>
      React.createElement(View, { testID: "expo-link" }, props.children),
    useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  };
});

jest.mock("../src/features/catalog/use-restaurants", () => ({
  useRestaurants: () => ({
    kind: "ready",
    restaurants: [
      {
        id: "restaurant-1",
        name: "McDonald's",
        cuisines: ["American", "Burgers"],
        branchId: "branch-1",
        branchName: "Magsaysay",
        heroImageUrl: "https://example.test/photo.avif",
      },
    ],
    retry: jest.fn(),
  }),
}));

jest.mock("../src/auth/auth-client", () => ({
  getMobileAuthClient: () => {
    throw new Error("no session in test");
  },
  readMobileApiUrl: () => "https://preview.ordah-please.test",
  readMobileSessionCookie: () => {
    throw new Error("no session in test");
  },
}));

describe("HomeScreen", () => {
  it("shows the product identity on the native entry screen", async () => {
    const screen = await render(<HomeScreen />);

    expect(screen.getByText("ordah please")).toBeTruthy();
  });

  it("renders the real catalog and opens a restaurant detail route", async () => {
    const screen = await render(<HomeScreen />);

    expect(screen.getByText("McDonald's")).toBeTruthy();
    expect(screen.getByText("American · Burgers")).toBeTruthy();
    expect(screen.getByText("Magsaysay")).toBeTruthy();

    await fireEvent.press(
      screen.getByRole("button", { name: "Open McDonald's" }),
    );
    expect(mockPush).toHaveBeenCalledWith("/restaurants/restaurant-1");
  });
});
