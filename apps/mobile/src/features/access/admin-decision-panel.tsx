import { designTokens } from "@ordah-please/ui";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { Button, Surface, Text, TextInput } from "react-native-paper";

import { buildAuthenticatedRequestInit } from "../../auth/authenticated-request";

type AdminDecision = "approved" | "rejected";

type PanelStatus = "loading" | "ready" | "forbidden" | "error";

type PendingRequest = Readonly<{
  id: string;
  requesterDisplayName: string;
  groupName: string;
  createdAt: string;
}>;

type RequestFn = (input: string, init: RequestInit) => Promise<Response>;

interface AdminDecisionPanelProps {
  apiBaseUrl: string;
  cookie: string;
  request?: RequestFn;
}

/** Reads the data field from a successful trusted API envelope. */
async function responseData(response: Response): Promise<unknown> {
  if (!response.ok) {
    throw new Error(response.status === 403 ? "forbidden" : "request-failed");
  }
  const value: unknown = await response.json();
  if (
    typeof value !== "object" ||
    value === null ||
    !("ok" in value) ||
    value.ok !== true ||
    !("data" in value)
  ) {
    throw new Error("request-failed");
  }
  return (value as { data: unknown }).data;
}

/** Narrows the pending admin-request list returned to a platform admin. */
function parsePendingList(value: unknown): readonly PendingRequest[] {
  if (typeof value !== "object" || value === null || !("requests" in value)) {
    throw new Error("request-failed");
  }
  const list = value.requests;
  if (!Array.isArray(list)) {
    throw new Error("request-failed");
  }
  return list.map((entry) => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      typeof (entry as PendingRequest).id !== "string" ||
      typeof (entry as PendingRequest).requesterDisplayName !== "string" ||
      typeof (entry as PendingRequest).groupName !== "string" ||
      typeof (entry as PendingRequest).createdAt !== "string"
    ) {
      throw new Error("request-failed");
    }
    return entry as PendingRequest;
  });
}

/** Formats an ISO timestamp as a stable UTC date for display. */
function formatSubmittedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toISOString().slice(0, 10);
}

/** Connects the native platform-admin decision UI to the pending and decide routes. */
export function AdminDecisionPanel({
  apiBaseUrl,
  cookie,
  request = fetch,
}: AdminDecisionPanelProps) {
  const [requests, setRequests] = useState<readonly PendingRequest[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<PanelStatus>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const actionInFlight = useRef(false);

  const base = apiBaseUrl.replace(/\/$/u, "");

  const loadPending = async (): Promise<readonly PendingRequest[]> => {
    const response = await request(
      `${base}/api/access/admin-requests/pending`,
      buildAuthenticatedRequestInit(cookie, { method: "GET" }),
    );
    return parsePendingList(await responseData(response));
  };

  useEffect(() => {
    let cancelled = false;
    void loadPending()
      .then((list) => {
        if (cancelled) return;
        setRequests(list);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStatus(
          error instanceof Error && error.message === "forbidden"
            ? "forbidden"
            : "error",
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const decide = async (requestId: string, decision: AdminDecision) => {
    if (actionInFlight.current) {
      return;
    }
    actionInFlight.current = true;
    setBusyRequestId(requestId);
    setMessage(null);
    const reason = reasons[requestId]?.trim();
    try {
      await responseData(
        await request(
          `${base}/api/access/admin-requests/decide`,
          buildAuthenticatedRequestInit(cookie, {
            body: JSON.stringify({
              requestId,
              decision,
              ...(reason === undefined || reason === "" ? {} : { reason }),
            }),
            headers: { "Content-Type": "application/json" },
            method: "POST",
          }),
        ),
      );
      setRequests((current) =>
        current.filter((entry) => entry.id !== requestId),
      );
      setReasons((current) => {
        if (!(requestId in current)) {
          return current;
        }
        const next = { ...current };
        delete next[requestId];
        return next;
      });
    } catch {
      setMessage(`The ${decision} action could not be completed.`);
    } finally {
      actionInFlight.current = false;
      setBusyRequestId(null);
    }
  };

  if (status === "loading") {
    return (
      <View style={styles.statusWrap}>
        <ActivityIndicator
          accessibilityLabel="Loading admin requests"
          size="large"
        />
      </View>
    );
  }
  if (status === "forbidden") {
    return (
      <View style={styles.statusWrap}>
        <Text style={styles.statusText}>
          Only platform admins can review access requests.
        </Text>
      </View>
    );
  }
  if (status === "error") {
    return (
      <View style={styles.statusWrap}>
        <Text style={styles.statusText}>
          Admin requests could not be loaded.
        </Text>
        <Button
          mode="contained"
          onPress={() => {
            setStatus("loading");
            void loadPending()
              .then((list) => {
                setRequests(list);
                setStatus("ready");
              })
              .catch((error: unknown) => {
                setStatus(
                  error instanceof Error && error.message === "forbidden"
                    ? "forbidden"
                    : "error",
                );
              });
          }}
        >
          Try again
        </Button>
      </View>
    );
  }

  if (requests.length === 0) {
    return (
      <View style={styles.statusWrap}>
        <Text style={styles.statusText}>
          There are no pending platform-admin requests.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.list} style={styles.scroll}>
      {requests.map((requestEntry) => {
        const cardBusy = busyRequestId === requestEntry.id;
        return (
          <Surface
            key={requestEntry.id}
            elevation={1}
            style={styles.card}
            accessibilityRole="summary"
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>
                {requestEntry.requesterDisplayName}
              </Text>
              <Text style={styles.cardSubtitle}>{requestEntry.groupName}</Text>
              <Text style={styles.cardMeta}>
                Submitted {formatSubmittedAt(requestEntry.createdAt)}
              </Text>
            </View>
            <TextInput
              label="Reason (optional)"
              maxLength={500}
              mode="outlined"
              onChangeText={(value) => {
                setReasons((current) => ({
                  ...current,
                  [requestEntry.id]: value,
                }));
              }}
              style={styles.reasonInput}
              value={reasons[requestEntry.id] ?? ""}
            />
            <View style={styles.buttonRow}>
              <Button
                disabled={cardBusy}
                mode="contained"
                onPress={() => {
                  void decide(requestEntry.id, "approved");
                }}
                style={styles.button}
              >
                Approve
              </Button>
              <Button
                disabled={cardBusy}
                mode="outlined"
                onPress={() => {
                  void decide(requestEntry.id, "rejected");
                }}
                style={styles.button}
              >
                Reject
              </Button>
            </View>
          </Surface>
        );
      })}
      {message === null ? null : (
        <Text accessibilityRole="alert" style={styles.messageText}>
          {message}
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
  },
  buttonRow: {
    flexDirection: "row",
    gap: designTokens.spacing.md,
    minHeight: designTokens.touchTarget.minimum,
  },
  card: {
    borderRadius: designTokens.radii.card,
    gap: designTokens.spacing.md,
    paddingHorizontal: designTokens.spacing.lg,
    paddingVertical: designTokens.spacing.lg,
  },
  cardHeader: {
    gap: designTokens.spacing.xs,
  },
  cardMeta: {
    color: designTokens.colors.textSecondary,
    fontFamily: "NunitoSans_400Regular",
    fontSize: designTokens.typography.size.label,
  },
  cardSubtitle: {
    color: designTokens.colors.textSecondary,
    fontFamily: "NunitoSans_600SemiBold",
    fontSize: designTokens.typography.size.body,
  },
  cardTitle: {
    color: designTokens.colors.textPrimary,
    fontFamily: "NunitoSans_700Bold",
    fontSize: designTokens.typography.size.title,
  },
  list: {
    gap: designTokens.spacing.lg,
    padding: designTokens.spacing.lg,
  },
  messageText: {
    color: designTokens.colors.error,
    fontFamily: "NunitoSans_400Regular",
    fontSize: designTokens.typography.size.body,
  },
  reasonInput: {
    backgroundColor: designTokens.colors.surface,
  },
  scroll: {
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
    backgroundColor: designTokens.colors.canvas,
    flex: 1,
    gap: designTokens.spacing.md,
    justifyContent: "center",
    padding: designTokens.spacing.lg,
  },
});
