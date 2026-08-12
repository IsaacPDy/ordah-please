// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockSignOut, mockRefresh } = vi.hoisted(() => ({
  mockSignOut: vi.fn<[], Promise<unknown>>(),
  mockRefresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.mock("../../src/auth/auth-client", () => ({
  authClient: {
    signOut: (): Promise<unknown> => mockSignOut(),
  },
}));

import { ProfileMenu } from "./profile-menu";

describe("ProfileMenu (web)", () => {
  beforeEach(() => {
    mockSignOut.mockReset();
    mockRefresh.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the avatar image when an image URL is supplied", () => {
    render(
      <ProfileMenu
        displayName="Mia Tan"
        email="mia@example.com"
        imageUrl="https://example.test/mia.jpg"
      />,
    );

    const button = screen.getByRole("button", {
      name: "Open profile menu for Mia Tan (mia@example.com)",
    });
    const image = button.querySelector("img");
    expect(image?.getAttribute("src")).toBe("https://example.test/mia.jpg");
  });

  it("renders the initials fallback when the image URL is null", () => {
    render(
      <ProfileMenu
        displayName="Mia Tan"
        email="mia@example.com"
        imageUrl={null}
      />,
    );

    const button = screen.getByRole("button", {
      name: "Open profile menu for Mia Tan (mia@example.com)",
    });
    expect(button.textContent).toContain("M");
    expect(button.querySelector("img")).toBeNull();
  });

  it("falls back to '?' when the display name is empty", () => {
    render(<ProfileMenu displayName="" email="" imageUrl={null} />);

    const button = screen.getByRole("button", {
      name: "Open profile menu for Your account",
    });
    expect(button.textContent).toContain("?");
  });

  it("opens the dropdown on click, then closes it on Escape", () => {
    render(
      <ProfileMenu
        displayName="Mia Tan"
        email="mia@example.com"
        imageUrl={null}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Open profile menu for Mia Tan (mia@example.com)",
      }),
    );
    expect(screen.getByText("Mia Tan")).toBeTruthy();
    expect(screen.getByText("mia@example.com")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Sign out/ })).toBeTruthy();

    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByText("mia@example.com")).toBeNull();
  });

  it("closes the dropdown on outside click", () => {
    render(
      <ProfileMenu
        displayName="Mia Tan"
        email="mia@example.com"
        imageUrl={null}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Open profile menu for Mia Tan (mia@example.com)",
      }),
    );
    expect(screen.getByText("mia@example.com")).toBeTruthy();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByText("mia@example.com")).toBeNull();
  });

  it("calls signOut and refreshes the router when Sign out succeeds", async () => {
    mockSignOut.mockResolvedValue(undefined);

    render(
      <ProfileMenu
        displayName="Mia Tan"
        email="mia@example.com"
        imageUrl={null}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Open profile menu for Mia Tan (mia@example.com)",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Sign out/ }));

    await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("mia@example.com")).toBeNull();
  });

  it("surfaces an inline error and Try again when signOut rejects", async () => {
    mockSignOut.mockRejectedValue(new Error("network"));

    render(
      <ProfileMenu
        displayName="Mia Tan"
        email="mia@example.com"
        imageUrl={null}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Open profile menu for Mia Tan (mia@example.com)",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Sign out/ }));

    await waitFor(() =>
      expect(screen.getByText("Could not sign out.")).toBeTruthy(),
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
});
