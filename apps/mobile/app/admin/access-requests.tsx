import { designTokens } from "@ordah-please/ui";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getMobileAuthClient,
  readMobileApiUrl,
  readMobileSessionCookie,
} from "../../src/auth/auth-client";
import { AdminDecisionPanel } from "../../src/features/access/admin-decision-panel";

type ScreenStatus =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "ready"; cookie: string };

/** Reads the native session cookie before mounting the platform-admin decision panel. */
export default function AdminAccessRequestsScreen() {
  const [status, setStatus] = useState<ScreenStatus>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve()
      .then(() => readMobileSessionCookie(getMobileAuthClient()))
      .then((cookie) => {
        if (!cancelled) {
          setStatus({ kind: "ready", cookie });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus({ kind: "signed-out" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      {status.kind === "loading" ? (
        <View style={styles.statusWrap}>
          <ActivityIndicator
            accessibilityLabel="Loading admin requests"
            size="large"
          />
        </View>
      ) : null}
      {status.kind === "signed-out" ? (
        <View style={styles.statusWrap}>
          <Text style={styles.statusText}>Sign in is required.</Text>
        </View>
      ) : null}
      {status.kind === "ready" ? (
        <AdminDecisionPanel
          apiBaseUrl={readMobileApiUrl()}
          cookie={status.cookie}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: designTokens.colors.canvas,
    flex: 1,
  },
  statusText: {
    color: designTokens.colors.textPrimary,
    fontFamily: "NunitoSans_400Regular",
    fontSize: designTokens.typography.size.body,
    textAlign: "center",
  },
  statusWrap: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: designTokens.spacing.lg,
  },
});
