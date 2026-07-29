import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { SafeAreaView, StyleSheet, View } from "react-native";

import {
  getMobileAuthClient,
  readMobileApiUrl,
  readMobileSessionCookie,
} from "../../src/auth/auth-client";
import { acceptInvitation } from "../../src/features/access/accept-invitation";
import { InvitationOnboarding } from "../../src/features/access/invitation-onboarding";
import {
  readInvitationToken,
  signInForNativeInvitation,
} from "../../src/features/access/native-invitation";

type InvitationStatus = "idle" | "submitting" | "success" | "error";

const authClient = getMobileAuthClient();

/** Connects a native invitation deep link to Better Auth sign-in and group acceptance. */
export default function InvitationRoute() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const publicToken = readInvitationToken(params.token);
  const { data: session } = authClient.useSession();
  const [status, setStatus] = useState<InvitationStatus>("idle");

  /** Starts Google sign-in and returns the user to this exact invitation. */
  async function handleSignIn() {
    try {
      if (!publicToken) {
        throw new Error("A valid invitation token is required.");
      }
      setStatus("submitting");
      await signInForNativeInvitation(publicToken, authClient.signIn.social);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  /** Sends the signed-in user's encrypted session cookie to accept the invitation. */
  async function handleAccept() {
    try {
      if (!publicToken) {
        throw new Error("A valid invitation token is required.");
      }
      setStatus("submitting");
      await acceptInvitation({
        apiBaseUrl: readMobileApiUrl(),
        publicToken,
        sessionCookie: readMobileSessionCookie(authClient),
      });
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <InvitationOnboarding
          isSignedIn={Boolean(session?.user)}
          onAccept={() => void handleAccept()}
          onSignIn={() => void handleSignIn()}
          status={status}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  safeArea: {
    flex: 1,
  },
});
