"use client";

import { useState } from "react";

export interface CreateGroupDialogProps {
  readonly users: readonly { readonly id: string; readonly displayName: string }[];
}

/** Modal form for a Platform Admin to create a new group with a name and chosen Owner. */
export function CreateGroupDialog({ users }: CreateGroupDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [ownerId, setOwnerId] = useState(users[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setOwnerId(users[0]?.id ?? "");
    setError(null);
  }

  async function submit() {
    if (name.trim().length === 0) {
      setError("Group name is required.");
      return;
    }
    if (ownerId.length === 0) {
      setError("Pick an owner.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/groups/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, ownerId }),
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }
      setOpen(false);
      reset();
      window.location.reload();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not create the group.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        className="admin-primary-button"
        onClick={() => setOpen(true)}
        type="button"
      >
        Create group
      </button>
    );
  }

  return (
    <div className="admin-dialog-backdrop" role="dialog" aria-modal="true">
      <div className="admin-dialog">
        <h2>Create group</h2>
        <label className="admin-field">
          <span>Group name</span>
          <input
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </label>
        <label className="admin-field">
          <span>Owner</span>
          <select
            onChange={(event) => setOwnerId(event.target.value)}
            value={ownerId}
          >
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName}
              </option>
            ))}
          </select>
        </label>
        {error !== null ? (
          <p role="alert" className="admin-error">
            {error}
          </p>
        ) : null}
        <div className="admin-dialog-actions">
          <button
            className="admin-secondary-button"
            disabled={submitting}
            onClick={() => {
              setOpen(false);
              reset();
            }}
            type="button"
          >
            Cancel
          </button>
          <button
            className="admin-primary-button"
            disabled={submitting}
            onClick={() => {
              void submit();
            }}
            type="button"
          >
            {submitting ? "Creating…" : "Create group"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Reads the safe public message from a failed response, or returns a fallback. */
async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: unknown } };
    const message = body?.error?.message;
    return typeof message === "string" ? message : "Request failed.";
  } catch {
    return "Request failed.";
  }
}
