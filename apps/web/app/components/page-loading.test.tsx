// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  AdminPageLoading,
  AppPageLoading,
  MemberPageLoading,
} from "./page-loading";

afterEach(cleanup);

describe("route loading states", () => {
  it("announces member loading with stable card placeholders", () => {
    render(<MemberPageLoading />);

    expect(screen.getByRole("status").textContent).toContain("Loading page");
    expect(screen.getAllByTestId("loading-card")).toHaveLength(3);
  });

  it("announces admin loading with a stable table placeholder", () => {
    render(<AdminPageLoading />);

    expect(screen.getByRole("status").textContent).toContain("Loading page");
    expect(screen.getByTestId("loading-table")).toBeTruthy();
  });

  it("keeps a neutral branded fallback around uncached route content", () => {
    render(<AppPageLoading />);

    expect(screen.getByRole("status").textContent).toContain("Loading page");
    expect(screen.getByText("ordah please")).toBeTruthy();
  });
});
