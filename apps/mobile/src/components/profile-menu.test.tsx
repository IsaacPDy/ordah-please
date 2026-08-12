import {
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react-native";

import { ProfileMenu } from "./profile-menu";

jest.mock("../features/access/mobile-member-gate", () => ({
  useMobileSignOut: () => mockGateSignOut,
}));

const mockGateSignOut = jest.fn();

describe("ProfileMenu (mobile)", () => {
  beforeEach(() => {
    mockGateSignOut.mockReset();
  });

  it("renders the avatar image when an image URL is supplied", async () => {
    const screen = await render(
      <ProfileMenu
        displayName="Mia Tan"
        email="mia@example.com"
        imageUrl="https://example.test/mia.jpg"
      />,
    );

    expect(screen.getByLabelText("Profile picture")).toBeTruthy();
  });

  it("renders the initials fallback when the image URL is null", async () => {
    const screen = await render(
      <ProfileMenu
        displayName="Mia Tan"
        email="mia@example.com"
        imageUrl={null}
      />,
    );

    const placeholder = screen.getByLabelText("Profile picture placeholder");
    expect(within(placeholder).getByText("M")).toBeTruthy();
  });

  it("falls back to '?' when the display name is empty", async () => {
    const screen = await render(
      <ProfileMenu displayName="" email="" imageUrl={null} />,
    );

    const placeholder = screen.getByLabelText("Profile picture placeholder");
    expect(within(placeholder).getByText("?")).toBeTruthy();
  });

  it("opens the panel on avatar tap, then closes it on backdrop tap", async () => {
    const screen = await render(
      <ProfileMenu
        displayName="Mia Tan"
        email="mia@example.com"
        imageUrl={null}
      />,
    );

    await fireEvent.press(screen.getByLabelText(/Open profile menu/));
    expect(screen.getByText("Mia Tan")).toBeTruthy();
    expect(screen.getByText("mia@example.com")).toBeTruthy();
    expect(screen.getByLabelText("Sign out")).toBeTruthy();

    await fireEvent.press(screen.getByLabelText("Close profile menu"));
    expect(screen.queryByText("mia@example.com")).toBeNull();
  });

  it("calls the gate sign-out callback when Sign out succeeds", async () => {
    mockGateSignOut.mockResolvedValue(undefined);

    const screen = await render(
      <ProfileMenu
        displayName="Mia Tan"
        email="mia@example.com"
        imageUrl={null}
      />,
    );

    await fireEvent.press(screen.getByLabelText(/Open profile menu/));
    await fireEvent.press(screen.getByLabelText("Sign out"));

    await waitFor(() => expect(mockGateSignOut).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("mia@example.com")).toBeNull();
  });

  it("surfaces an inline error and Try again when signOut rejects", async () => {
    mockGateSignOut.mockRejectedValue(new Error("network"));

    const screen = await render(
      <ProfileMenu
        displayName="Mia Tan"
        email="mia@example.com"
        imageUrl={null}
      />,
    );

    await fireEvent.press(screen.getByLabelText(/Open profile menu/));
    await fireEvent.press(screen.getByLabelText("Sign out"));

    await waitFor(() =>
      expect(screen.getByText("Could not sign out.")).toBeTruthy(),
    );
    expect(screen.getByLabelText("Try signing out again")).toBeTruthy();
  });
});
