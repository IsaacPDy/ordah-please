import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";

import { parseGroupDetailsResponse } from "@ordah-please/contracts";
import { designTokens } from "@ordah-please/ui";

import {
  getMobileAuthClient,
  readMobileApiUrl,
  readMobileSessionCookie,
} from "../../../src/auth/auth-client";
import { buildAuthenticatedRequestInit } from "../../../src/auth/authenticated-request";
import { MemberPage } from "../../../src/components/member-page";
import { GroupDetailsScreen } from "../../../src/features/groups/group-details-screen";

type GroupDetails = ReturnType<typeof parseGroupDetailsResponse>;

type ScreenStatus =
  | { kind: "loading" }
  | { kind: "forbidden" }
  | { kind: "error" }
  | { kind: "ready"; details: GroupDetails };

/** Normalizes the dynamic route parameter into a single non-empty string or null. */
function readGroupId(value: string | string[] | undefined): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/** Extracts the data field from a trusted API success envelope, or throws. */
function readTrustedEnvelope(value: unknown): unknown {
  if (
    typeof value !== "object" ||
    value === null ||
    !("ok" in value) ||
    value.ok !== true ||
    !("data" in value)
  ) {
    throw new Error("Group details response is invalid.");
  }
  return (value as { data: unknown }).data;
}

/** Loads and renders one group's details against the trusted web API. */
export default function GroupDetailsRoute() {
  const params = useLocalSearchParams<{ groupId?: string | string[] }>();
  const groupId = readGroupId(params.groupId);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<ScreenStatus>({ kind: "loading" });

  useEffect(() => {
    if (groupId === null) {
      return;
    }
    let cancelled = false;

    void (async () => {
      try {
        const cookie = readMobileSessionCookie(getMobileAuthClient());
        const response = await fetch(
          `${readMobileApiUrl()}/api/groups/${encodeURIComponent(groupId)}/details`,
          buildAuthenticatedRequestInit(cookie, { method: "GET" }),
        );
        if (cancelled) return;
        if (response.status === 403) {
          setStatus({ kind: "forbidden" });
          return;
        }
        if (!response.ok) {
          setStatus({ kind: "error" });
          return;
        }
        const details = parseGroupDetailsResponse(
          readTrustedEnvelope(await response.json()),
        );
        if (!cancelled) {
          setStatus({ kind: "ready", details });
        }
      } catch {
        if (!cancelled) {
          setStatus({ kind: "error" });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [groupId, attempt]);

  if (groupId === null) {
    return (
      <MemberPage title="Group details">
        <View style={styles.statusWrap}>
          <Text accessibilityRole="alert" style={styles.statusText}>
            Group details could not be loaded.
          </Text>
        </View>
      </MemberPage>
    );
  }

  return (
    <MemberPage title="Group details">
      {status.kind === "loading" ? (
        <View style={styles.statusWrap}>
          <ActivityIndicator
            accessibilityLabel="Loading group details"
            size="large"
          />
        </View>
      ) : null}
      {status.kind === "forbidden" ? (
        <View style={styles.statusWrap}>
          <Text accessibilityRole="alert" style={styles.statusText}>
            You do not have access to this group.
          </Text>
        </View>
      ) : null}
      {status.kind === "error" ? (
        <View style={styles.statusWrap}>
          <Text accessibilityRole="alert" style={styles.statusText}>
            Group details could not be loaded.
          </Text>
          <Button
            mode="contained"
            onPress={() => {
              setStatus({ kind: "loading" });
              setAttempt((value) => value + 1);
            }}
          >
            Try again
          </Button>
        </View>
      ) : null}
      {status.kind === "ready" ? (
        <GroupDetailsScreen details={status.details} />
      ) : null}
    </MemberPage>
  );
}

const styles = StyleSheet.create({
  statusText: {
    color: designTokens.colors.textPrimary,
    fontFamily: "NunitoSans_400Regular",
    fontSize: designTokens.typography.size.body,
    textAlign: "center",
  },
  statusWrap: {
    alignItems: "center",
    backgroundColor: designTokens.colors.canvas,
    gap: designTokens.spacing.md,
    justifyContent: "center",
    padding: designTokens.spacing.lg,
  },
});
