// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/admin" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

import { AdminNavigation } from "./admin-navigation";

afterEach(cleanup);

describe("admin navigation current destination", () => {
  it("keeps Catalog selected while editing a restaurant", () => {
    navigation.pathname = "/admin/catalog/restaurant-1/edit";
    render(<AdminNavigation />);
    expect(
      screen
        .getByRole("link", { name: "Catalog" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen
        .getByRole("link", { name: "Overview" })
        .getAttribute("aria-current"),
    ).toBeNull();
  });

  it("selects only Overview on the admin root", () => {
    navigation.pathname = "/admin";
    render(<AdminNavigation />);
    expect(
      screen
        .getByRole("link", { name: "Overview" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen
        .getAllByRole("link")
        .filter((link) => link.getAttribute("aria-current")),
    ).toHaveLength(1);
  });
});
