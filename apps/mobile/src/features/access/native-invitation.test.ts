import {
  readInvitationToken,
  signInForNativeInvitation,
} from "./native-invitation";

describe("native invitation helpers", () => {
  it("accepts only one non-empty Expo route token", () => {
    expect(readInvitationToken("invite.v1.token")).toBe("invite.v1.token");
    expect(readInvitationToken("")).toBeNull();
    expect(readInvitationToken(["one", "two"])).toBeNull();
    expect(readInvitationToken(undefined)).toBeNull();
  });

  it("starts Google sign-in with the encoded native invitation return path", async () => {
    const signIn = jest.fn(() => Promise.resolve());

    await signInForNativeInvitation("invite.v1/preview token", signIn);

    expect(signIn).toHaveBeenCalledWith({
      callbackURL: "/invite/invite.v1%2Fpreview%20token",
      provider: "google",
    });
  });
});
