// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: () => null,
}));

import { EditForm } from "./edit-form";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("restaurant edit form", () => {
  it("sends editable branch name and Grab URL with the restaurant patch", async () => {
    let requestInit: RequestInit | undefined;
    const request = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      requestInit = init;
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    });
    vi.stubGlobal("fetch", request);
    render(
      <EditForm
        initial={{
          branchId: "branch-1",
          branchName: "Old branch",
          categories: [],
          cuisines: ["Fast Food"],
          grabUrl: "https://food.grab.com/old",
          menuVersionPublishedAt: "2026-08-12T00:00:00.000Z",
          restaurantId: "restaurant-1",
          restaurantName: "Restaurant",
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Branch name"), {
      target: { value: "New branch" },
    });
    fireEvent.change(screen.getByLabelText("Grab URL"), {
      target: { value: "https://food.grab.com/new" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    if (typeof requestInit?.body !== "string") {
      throw new TypeError("Expected the restaurant patch body to be JSON.");
    }
    expect(JSON.parse(requestInit.body)).toMatchObject({
      branchName: "New branch",
      grabUrl: "https://food.grab.com/new",
    });
  });
});
