"use client";

import { useEffect, useState } from "react";

import { TeamAccessView, type GroupMemberView } from "./team-access-view";

type PanelStatus = "loading" | "ready" | "forbidden" | "error";

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

/** Narrows the active member list returned to the owner Team screen. */
function parseMembers(value: unknown): readonly GroupMemberView[] {
  if (!Array.isArray(value)) {
    throw new Error("request-failed");
  }
  const entries: readonly unknown[] = value;
  return entries.map((member) => {
    if (
      typeof member !== "object" ||
      member === null ||
      !("displayName" in member) ||
      typeof member.displayName !== "string" ||
      !("userId" in member) ||
      typeof member.userId !== "string" ||
      !("role" in member) ||
      (member.role !== "owner" &&
        member.role !== "organizer" &&
        member.role !== "member")
    ) {
      throw new Error("request-failed");
    }
    return {
      displayName: member.displayName,
      role: member.role,
      userId: member.userId,
    };
  });
}

/** Fetches and validates the owner-visible active member list. */
async function fetchMembers(): Promise<readonly GroupMemberView[]> {
  const response = await fetch("/api/access/members");
  return parseMembers(await responseData(response));
}

/** Maps a member-list failure into the UI state safe to show on Team. */
function memberLoadFailure(error: unknown): PanelStatus {
  return error instanceof Error && error.message === "forbidden"
    ? "forbidden"
    : "error";
}

/** Connects the owner Team view to authenticated group-access routes. */
export function TeamAccessPanel() {
  const [members, setMembers] = useState<readonly GroupMemberView[]>([]);
  const [status, setStatus] = useState<PanelStatus>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [invitationUrl, setInvitationUrl] = useState<string | null>(null);

  /** Reloads the member list after an owner changes group access. */
  const refreshMembers = async () => {
    try {
      setMembers(await fetchMembers());
      setStatus("ready");
    } catch (error) {
      setStatus(memberLoadFailure(error));
    }
  };

  useEffect(() => {
    let cancelled = false;
    void fetchMembers()
      .then((loadedMembers) => {
        if (!cancelled) {
          setMembers(loadedMembers);
          setStatus("ready");
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setStatus(memberLoadFailure(error));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Applies one allowed owner role action and refreshes the visible team. */
  const performMemberAction = async (
    action: "promote" | "demote" | "remove",
    userId: string,
  ) => {
    if (
      action === "remove" &&
      !window.confirm("Remove this member from the group?")
    ) {
      return;
    }
    setMessage(null);
    try {
      await responseData(
        await fetch(`/api/access/members/${action}`, {
          body: JSON.stringify({ userId }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        }),
      );
      await refreshMembers();
    } catch {
      setMessage("The member action could not be completed.");
    }
  };

  /** Creates a seven-day public invitation link for the current deployment. */
  const issueInvitation = async () => {
    setMessage(null);
    try {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000);
      const data = await responseData(
        await fetch("/api/access/invitations", {
          body: JSON.stringify({ expiresAt: expiresAt.toISOString() }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        }),
      );
      if (
        typeof data !== "object" ||
        data === null ||
        !("publicToken" in data) ||
        typeof data.publicToken !== "string"
      ) {
        throw new Error("request-failed");
      }
      setInvitationUrl(
        `${window.location.origin}/invite/${encodeURIComponent(data.publicToken)}`,
      );
    } catch {
      setMessage("An invitation link could not be created.");
    }
  };

  /** Submits the owner's platform-admin request without approving it. */
  const requestAdmin = async () => {
    setMessage(null);
    try {
      await responseData(
        await fetch("/api/access/admin-requests", {
          body: "{}",
          headers: { "Content-Type": "application/json" },
          method: "POST",
        }),
      );
      setMessage("Platform-admin request submitted.");
    } catch {
      setMessage("A platform-admin request is already pending or unavailable.");
    }
  };

  if (status === "loading") {
    return <p role="status">Loading team…</p>;
  }
  if (status === "forbidden") {
    return <p>Only the group owner can manage member roles.</p>;
  }
  if (status === "error") {
    return (
      <div>
        <p role="alert">Team details could not be loaded.</p>
        <button
          onClick={() => {
            setStatus("loading");
            void refreshMembers();
          }}
          type="button"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <>
      <TeamAccessView
        members={members}
        onAction={(action, userId) => {
          void performMemberAction(action, userId);
        }}
        onIssueInvitation={() => {
          void issueInvitation();
        }}
        onRequestAdmin={() => {
          void requestAdmin();
        }}
      />
      {invitationUrl === null ? null : (
        <p>
          Invitation link: <a href={invitationUrl}>{invitationUrl}</a>
        </p>
      )}
      {message === null ? null : <p role="status">{message}</p>}
    </>
  );
}
