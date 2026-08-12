// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { RecentImportsTable } from "./recent-imports-table";

afterEach(cleanup);

describe("recent catalog imports table", () => {
  it("shows the stored filename, restaurant count, and status", () => {
    render(
      <RecentImportsTable
        imports={[
          {
            createdAt: new Date("2026-08-12T04:00:00.000Z"),
            id: "import-1",
            restaurantCount: 2,
            sourceFileName: "restaurants.csv",
            status: "published",
          },
        ]}
      />,
    );

    expect(screen.getByText("restaurants.csv")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("Published")).toBeTruthy();
  });
});
