import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native-paper";

import { getMobileAuthClient } from "../../auth/auth-client";
import { MobileMemberGate, useMobileSignOut } from "./mobile-member-gate";
import { useAppIdentity } from "./use-app-identity";

jest.mock("../../auth/auth-client", () => ({
  getMobileAuthClient: jest.fn(),
}));

jest.mock("./use-app-identity", () => ({
  useAppIdentity: jest.fn(),
}));

const mockGetMobileAuthClient = jest.mocked(getMobileAuthClient);
const mockUseAppIdentity = jest.mocked(useAppIdentity);

function SignOutProbe() {
  const signOut = useMobileSignOut();
  return (
    <Text testID="sign-out-probe" onPress={() => void signOut()}>
      probe
    </Text>
  );
}

describe("MobileMemberGate", () => {
  it("reloads application identity after Google sign-in stores the session cookie", async () => {
    const retry = jest.fn();
    const signIn = jest.fn(() => Promise.resolve());
    mockUseAppIdentity.mockReturnValue({ kind: "unauthenticated", retry });
    mockGetMobileAuthClient.mockReturnValue({
      signIn: { social: signIn },
    } as unknown as ReturnType<typeof getMobileAuthClient>);
    const screen = await render(
      <MobileMemberGate>Member tabs</MobileMemberGate>,
    );

    await fireEvent.press(screen.getByText("Sign in with Google"));

    await waitFor(() => expect(retry).toHaveBeenCalledTimes(1));
  });

  it("clears the session and retries identity after the sign-out flow fires", async () => {
    const retry = jest.fn();
    const signOut = jest.fn(() => Promise.resolve());
    mockUseAppIdentity.mockReturnValue({
      kind: "authenticated",
      identity: {
        displayName: "Mia Tan",
        email: "mia@example.com",
        imageUrl: null,
        isPlatformAdmin: false,
        memberships: [],
        pendingAdminRequestCount: 0,
      },
      retry,
    });
    mockGetMobileAuthClient.mockReturnValue({
      signOut,
    } as unknown as ReturnType<typeof getMobileAuthClient>);

    const screen = await render(
      <MobileMemberGate>
        <SignOutProbe />
      </MobileMemberGate>,
    );

    await fireEvent.press(screen.getByTestId("sign-out-probe"));

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(retry).toHaveBeenCalledTimes(1));
  });
});
