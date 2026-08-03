import { render } from "@testing-library/react-native";

import HomeScreen from "../app/(member)/index";

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

describe("HomeScreen", () => {
  it("shows the product identity on the native entry screen", async () => {
    const screen = await render(<HomeScreen />);

    expect(screen.getByText("ordah please")).toBeTruthy();
  });
});
