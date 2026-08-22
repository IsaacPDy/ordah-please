// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({
  back: vi.fn(),
  pathname: "/",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ back: navigation.back }),
}));

import {
  FloatingNewOrderButton,
  MemberBackButton,
} from "./member-shell-controls";

describe("member shell controls", () => {
  afterEach(() => {
    cleanup();
    navigation.back.mockReset();
    navigation.pathname = "/";
  });

  it("shows a back button on nested routes and uses browser history", () => {
    navigation.pathname = "/groups/group-1";
    render(<MemberBackButton />);

    fireEvent.click(screen.getByRole("button", { name: "Go back" }));

    expect(navigation.back).toHaveBeenCalledOnce();
  });

  it("keeps root tabs balanced without exposing a false back action", () => {
    render(<MemberBackButton />);

    expect(screen.queryByRole("button", { name: "Go back" })).toBeNull();
  });

  it("shows the permitted new-order action when the page has no equivalent action", () => {
    const { rerender } = render(<FloatingNewOrderButton visible />);
    expect(
      screen
        .getByRole("link", { name: "Start a new order" })
        .getAttribute("href"),
    ).toBe("/orders/new");

    navigation.pathname = "/orders/new";
    rerender(<FloatingNewOrderButton visible />);
    expect(
      screen.queryByRole("link", { name: "Start a new order" }),
    ).toBeNull();

    navigation.pathname = "/groups/group-1";
    rerender(<FloatingNewOrderButton visible />);
    expect(
      screen.queryByRole("link", { name: "Start a new order" }),
    ).toBeNull();

    navigation.pathname = "/restaurants/restaurant-1";
    rerender(<FloatingNewOrderButton visible />);
    expect(
      screen.queryByRole("link", { name: "Start a new order" }),
    ).toBeNull();
  });

  it("hides the new-order action when the viewer lacks permission", () => {
    render(<FloatingNewOrderButton visible={false} />);

    expect(
      screen.queryByRole("link", { name: "Start a new order" }),
    ).toBeNull();
  });
});
