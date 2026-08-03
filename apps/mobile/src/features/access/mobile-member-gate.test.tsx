import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { getMobileAuthClient } from "../../auth/auth-client";
import { MobileMemberGate } from "./mobile-member-gate";
import { useAppIdentity } from "./use-app-identity";

jest.mock("../../auth/auth-client", () => ({
  getMobileAuthClient: jest.fn(),
}));

jest.mock("./use-app-identity", () => ({
  useAppIdentity: jest.fn(),
}));

const mockGetMobileAuthClient = jest.mocked(getMobileAuthClient);
const mockUseAppIdentity = jest.mocked(useAppIdentity);

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
});
