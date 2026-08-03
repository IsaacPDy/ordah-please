import { fireEvent, render } from "@testing-library/react-native";

import { InvitationOnboarding } from "../src/features/access/invitation-onboarding";

describe("InvitationOnboarding", () => {
  it("requires Google sign-in before exposing invitation acceptance", async () => {
    const onAccept = jest.fn();
    const onSignIn = jest.fn();
    const screen = await render(
      <InvitationOnboarding
        isSignedIn={false}
        onAccept={onAccept}
        onSignIn={onSignIn}
        status="idle"
      />,
    );

    expect(screen.getByText("Sign in with Google to continue")).toBeTruthy();
    expect(screen.queryByText("Join group")).toBeNull();
    await fireEvent.press(screen.getByText("Sign in with Google"));
    expect(onSignIn).toHaveBeenCalledTimes(1);
    expect(onAccept).not.toHaveBeenCalled();
  });

  it("lets a signed-in user join the group without claiming order participation", async () => {
    const onAccept = jest.fn();
    const screen = await render(
      <InvitationOnboarding
        isSignedIn
        onAccept={onAccept}
        onSignIn={jest.fn()}
        status="idle"
      />,
    );

    expect(
      screen.getByText(
        "Joining the group does not add you to any food order. A Manager or Group Owner chooses order participants separately.",
      ),
    ).toBeTruthy();
    await fireEvent.press(screen.getByText("Join group"));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it("shows a safe error when Google sign-in fails", async () => {
    const screen = await render(
      <InvitationOnboarding
        isSignedIn={false}
        onAccept={jest.fn()}
        onSignIn={jest.fn()}
        status="error"
      />,
    );

    expect(
      screen.getByText("Sign-in or invitation acceptance failed."),
    ).toBeTruthy();
  });

  it.each([
    { button: "Sign in with Google", isSignedIn: false },
    { button: "Join group", isSignedIn: true },
  ])(
    "blocks duplicate $button submissions while a request is running",
    async ({ button, isSignedIn }) => {
      const onAccept = jest.fn();
      const onSignIn = jest.fn();
      const screen = await render(
        <InvitationOnboarding
          isSignedIn={isSignedIn}
          onAccept={onAccept}
          onSignIn={onSignIn}
          status="submitting"
        />,
      );

      await fireEvent.press(screen.getByText(button));

      expect(onAccept).not.toHaveBeenCalled();
      expect(onSignIn).not.toHaveBeenCalled();
    },
  );
});
