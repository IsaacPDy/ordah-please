"use client";

import { useEffect, useRef, useState } from "react";

import {
  AdminDecisionView,
  type PendingAdminRequestView,
} from "./admin-decision-view";

type AdminDecision = "approved" | "rejected";

type PanelStatus = "loading" | "ready" | "forbidden" | "error";

type PendingAdminRequest = Readonly<{
  id: string;
  requesterDisplayName: string;
  groupName: string;
  createdAt: string;
}>;

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
  return value.data;
}

/** Narrows the pending admin-request list returned to a platform admin. */
function parsePendingList(value: unknown): readonly PendingAdminRequest[] {
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
      typeof (entry as PendingAdminRequest).id !== "string" ||
      typeof (entry as PendingAdminRequest).requesterDisplayName !== "string" ||
      typeof (entry as PendingAdminRequest).groupName !== "string" ||
      typeof (entry as PendingAdminRequest).createdAt !== "string"
    ) {
      throw new Error("request-failed");
    }
    return entry as PendingAdminRequest;
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

/** Maps a list-fetch failure into the UI state safe to show on the admin page. */
function loadFailure(error: unknown): PanelStatus {
  return error instanceof Error && error.message === "forbidden"
    ? "forbidden"
    : "error";
}

/** Connects the platform-admin decision UI to the pending and decide routes. */
export function AdminDecisionPanel() {
  const [requests, setRequests] = useState<readonly PendingAdminRequest[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<PanelStatus>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const actionInFlight = useRef(false);

  const refresh = async () => {
    try {
      const parsed = parsePendingList(
        await responseData(
          await fetch("/api/access/admin-requests/pending", {
            method: "GET",
          }),
        ),
      );
      setRequests(parsed);
      setStatus("ready");
    } catch (error) {
      setStatus(loadFailure(error));
    }
  };

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/access/admin-requests/pending", { method: "GET" })
      .then(responseData)
      .then((data) => {
        if (cancelled) return;
        setRequests(parsePendingList(data));
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStatus(loadFailure(error));
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
        await fetch("/api/access/admin-requests/decide", {
          body: JSON.stringify({
            requestId,
            decision,
            ...(reason === undefined || reason === "" ? {} : { reason }),
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        }),
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
    return <p role="status">Loading admin requests…</p>;
  }
  if (status === "forbidden") {
    return <p>Only platform admins can review access requests.</p>;
  }
  if (status === "error") {
    return (
      <div>
        <p role="alert">Admin requests could not be loaded.</p>
        <button
          onClick={() => {
            setStatus("loading");
            void refresh();
          }}
          type="button"
        >
          Try again
        </button>
      </div>
    );
  }

  const viewRequests: readonly PendingAdminRequestView[] = requests.map(
    (request) => ({
      id: request.id,
      requesterDisplayName: request.requesterDisplayName,
      groupName: request.groupName,
      submittedAt: formatSubmittedAt(request.createdAt),
    }),
  );

  return (
    <AdminDecisionView
      actionsDisabled={busyRequestId !== null}
      busyRequestId={busyRequestId}
      message={message}
      onDecide={(requestId, decision) => {
        void decide(requestId, decision);
      }}
      onReasonChange={(requestId, value) => {
        setReasons((current) => ({ ...current, [requestId]: value }));
      }}
      reasons={reasons}
      requests={viewRequests}
    />
  );
}
