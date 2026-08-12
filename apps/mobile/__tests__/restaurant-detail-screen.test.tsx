import { fireEvent, render } from "@testing-library/react-native";

import RestaurantDetailRoute from "../app/(member)/restaurants/[id]";

const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "restaurant-1" }),
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }),
}));

jest.mock("../src/features/catalog/use-restaurant-detail", () => ({
  useRestaurantDetail: () => ({
    detail: {
      restaurantId: "restaurant-1",
      restaurantName: "McDonald's",
      cuisines: ["American", "Burgers"],
      branchId: "branch-1",
      branchName: "Magsaysay",
      grabUrl: null,
      menuVersionPublishedAt: "2026-08-12T00:00:00.000Z",
      categories: [
        {
          name: "Burgers",
          items: [
            {
              id: "item-1",
              name: "Classic Burger",
              description: "Beef burger",
              priceCentavos: 25000,
              availability: "available",
              imageUrl: "https://example.test/burger.avif",
              variants: [],
              modifierGroups: [],
            },
          ],
        },
      ],
    },
    kind: "ready",
    retry: jest.fn(),
  }),
}));

describe("RestaurantDetailRoute", () => {
  it("renders the restaurant menu and a working back action", async () => {
    const screen = await render(<RestaurantDetailRoute />);

    expect(screen.getByRole("header", { name: "McDonald's" })).toBeTruthy();
    expect(screen.getByText("Magsaysay")).toBeTruthy();
    expect(screen.getByText("American · Burgers")).toBeTruthy();
    expect(screen.getByRole("header", { name: "Burgers" })).toBeTruthy();
    expect(screen.getByText("Classic Burger")).toBeTruthy();
    expect(screen.getByText("Beef burger")).toBeTruthy();
    expect(screen.getByText("₱250.00")).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "Back" }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
