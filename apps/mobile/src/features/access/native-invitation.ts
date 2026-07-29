type NativeSocialSignIn = (input: {
  callbackURL: string;
  provider: "google";
}) => Promise<unknown>;

/** Reads one dynamic Expo route token without accepting ambiguous repeated parameters. */
export function readInvitationToken(
  value: string | string[] | undefined,
): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/** Starts Google sign-in while preserving the native invitation deep-link path. */
export async function signInForNativeInvitation(
  publicToken: string,
  signIn: NativeSocialSignIn,
): Promise<void> {
  await signIn({
    callbackURL: `/invite/${encodeURIComponent(publicToken)}`,
    provider: "google",
  });
}
