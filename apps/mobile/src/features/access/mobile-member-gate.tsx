import { createContext, useContext, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Text } from "react-native-paper";

import type { AppIdentitySummary } from "@ordah-please/contracts";
import { designTokens } from "@ordah-please/ui";

import { getMobileAuthClient } from "../../auth/auth-client";
import { useAppIdentity } from "./use-app-identity";

const EMPTY_IDENTITY: AppIdentitySummary = {
  displayName: "",
  email: "",
  imageUrl: null,
  isPlatformAdmin: false,
  memberships: [],
  pendingAdminRequestCount: 0,
};

const MobileAppIdentityContext = createContext(EMPTY_IDENTITY);
const MobileSignOutContext = createContext<
  () => Promise<void> | void
>(() => {});

/** Returns the authenticated native identity supplied by the member-tab gate. */
export function useMobileAppIdentity(): AppIdentitySummary {
  return useContext(MobileAppIdentityContext);
}

/** Returns the gate-supplied sign-out callback that clears the session and retries identity. */
export function useMobileSignOut(): () => Promise<void> | void {
  return useContext(MobileSignOutContext);
}

/** Supplies a known identity to native screen tests and authenticated child trees. */
export function MobileAppIdentityProvider({
  children,
  identity,
}: Readonly<{ children: ReactNode; identity: AppIdentitySummary }>) {
  return (
    <MobileAppIdentityContext.Provider value={identity}>
      {children}
    </MobileAppIdentityContext.Provider>
  );
}

/** Blocks native member tabs until cookie-authenticated application identity is known. */
export function MobileMemberGate({
  children,
}: Readonly<{ children: ReactNode }>) {
  const identityState = useAppIdentity();
  const [signInFailed, setSignInFailed] = useState(false);

  if (identityState.kind === "authenticated") {
    const handleSignOut = async () => {
      await getMobileAuthClient().signOut();
      identityState.retry();
    };
    return (
      <MobileAppIdentityProvider identity={identityState.identity}>
        <MobileSignOutContext.Provider value={handleSignOut}>
          {children}
        </MobileSignOutContext.Provider>
      </MobileAppIdentityProvider>
    );
  }

  if (identityState.kind === "loading") {
    return (
      <View style={styles.centered}>
        <ActivityIndicator accessibilityLabel="Loading account" />
        <Text>Loading your account…</Text>
      </View>
    );
  }

  if (identityState.kind === "unauthenticated") {
    return (
      <View style={styles.screen}>
        <View style={styles.content}>
          <Text style={styles.brand}>ordah please</Text>
          <Text style={styles.tagline}>Order together, hassle less.</Text>
          <Button
            mode="contained"
            style={styles.button}
            labelStyle={styles.buttonLabel}
            onPress={() => {
              setSignInFailed(false);
              void getMobileAuthClient()
                .signIn.social({ callbackURL: "/", provider: "google" })
                .then(() => identityState.retry())
                .catch(() => setSignInFailed(true));
            }}
          >
            Sign in with Google
          </Button>
          {signInFailed ? (
            <Text accessibilityRole="alert" style={styles.errorText}>
              Google sign-in could not start.
            </Text>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.centered}>
      <Text accessibilityRole="alert">
        {identityState.kind === "unavailable"
          ? "Your account is not available."
          : "Your account could not be loaded."}
      </Text>
      <Button mode="outlined" onPress={identityState.retry}>
        Try again
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: "center",
    backgroundColor: designTokens.colors.canvas,
    flex: 1,
    gap: designTokens.spacing.md,
    justifyContent: "center",
    padding: designTokens.spacing.lg,
  },
  screen: {
    alignItems: "center",
    backgroundColor: designTokens.colors.primary,
    flex: 1,
    justifyContent: "center",
    padding: designTokens.spacing.lg,
  },
  content: {
    alignItems: "center",
    gap: designTokens.spacing.md,
    maxWidth: 360,
    width: "100%",
  },
  brand: {
    color: designTokens.colors.onPrimary,
    fontFamily: designTokens.typography.family,
    fontSize: 40,
    fontWeight: "700",
    letterSpacing: -1.6,
    lineHeight: 44,
    marginBottom: designTokens.spacing.xs,
    textAlign: "center",
  },
  tagline: {
    color: designTokens.colors.onPrimary,
    fontFamily: designTokens.typography.family,
    fontSize: designTokens.typography.size.body,
    marginBottom: designTokens.spacing.lg,
    opacity: 0.9,
    textAlign: "center",
  },
  button: {
    backgroundColor: designTokens.colors.surface,
    borderRadius: 999,
    minWidth: "100%",
    paddingVertical: designTokens.spacing.xs,
  },
  buttonLabel: {
    color: designTokens.colors.textPrimary,
    fontFamily: designTokens.typography.family,
    fontSize: designTokens.typography.size.body,
    fontWeight: "700",
  },
  errorText: {
    color: designTokens.colors.onPrimary,
    fontFamily: designTokens.typography.family,
    textAlign: "center",
  },
});
