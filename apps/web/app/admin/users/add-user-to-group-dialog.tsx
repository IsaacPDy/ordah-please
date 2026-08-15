"use client";

import type { MouseEvent } from "react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import type { AdminUserSummary } from "../../../src/features/users/users-runtime";

export interface AdminGroupOption {
  readonly groupId: string;
  readonly name: string;
}

interface AddUserToGroupDialogProps {
  readonly users: readonly AdminUserSummary[];
  readonly groups: readonly AdminGroupOption[];
  readonly defaultUserId: string | null;
}

/** Modal form for a Platform Admin to add any active user to any active group as a Member. */
export function AddUserToGroupDialog({
  users,
  groups,
  defaultUserId,
}: AddUserToGroupDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openDialog() {
    setUserId(defaultUserId ?? users[0]?.id ?? "");
    setGroupId(groups[0]?.groupId ?? "");
    setError(null);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setError(null);
  }

  /** Handles only true backdrop clicks, never clicks inside the modal card. */
  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && !submitting) {
      close();
    }
  }

  async function submit() {
    if (userId.length === 0 || groupId.length === 0) {
      setError("Pick a user and a group.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(userId)}/memberships`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ groupId }),
        },
      );
      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }
      close();
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not add the user to the group.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        className="secondary-action"
        onClick={openDialog}
        type="button"
      >
        Add user to group
      </button>
    );
  }

  return createPortal(
    <div className="admin-dialog-backdrop" onClick={handleBackdropClick}>
      <div
        aria-labelledby="add-user-to-group-dialog-title"
        aria-modal="true"
        className="admin-dialog"
        role="dialog"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="admin-dialog-header">
            <div>
              <h2 id="add-user-to-group-dialog-title">Add user to group</h2>
              <p>The user joins the group as a Member.</p>
            </div>
          </div>
          <div className="admin-dialog-fields">
            <label className="admin-field">
              <span>User</span>
              <select
                onChange={(event) => setUserId(event.target.value)}
                value={userId}
              >
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-field">
              <span>Group</span>
              <select
                onChange={(event) => setGroupId(event.target.value)}
                value={groupId}
              >
                {groups.map((group) => (
                  <option key={group.groupId} value={group.groupId}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
            {error !== null ? (
              <p role="alert" className="admin-error">
                {error}
              </p>
            ) : null}
          </div>
          <div className="admin-dialog-actions">
            <button
              className="admin-secondary-button"
              disabled={submitting}
              onClick={close}
              type="button"
            >
              Cancel
            </button>
            <button
              className="admin-primary-button"
              disabled={submitting}
              type="submit"
            >
              {submitting ? "Adding…" : "Add to group"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

/** Reads the safe public message from a failed response, or returns a fallback. */
async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: unknown } };
    const message = body?.error?.message;
    return typeof message === "string" ? message : "Request failed.";
  } catch {
    return "Couldn't reach the server. Try again.";
  }
}
