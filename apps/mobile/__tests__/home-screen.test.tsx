import { render } from "@testing-library/react-native";

import HomeScreen from "../app/index";

describe("HomeScreen", () => {
  it("shows the product identity on the native entry screen", async () => {
    const screen = await render(<HomeScreen />);

    expect(screen.getByText("ordah please")).toBeTruthy();
  });
});
