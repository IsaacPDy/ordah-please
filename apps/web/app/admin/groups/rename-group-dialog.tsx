"use client";

import type { MouseEvent } from "react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

interface RenameGroupDialogProps {
  readonly group: { readonly groupId: string; readonly name: string };
  readonly onClose: () => void;
}

/** Modal form for a Platform Admin to rename any active group. */
export function RenameGroupDialog({ group, onClose }: RenameGroupDialogProps) {
  const router = useRouter();
  const [name, setName] = useState(group.name);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Handles only true backdrop clicks, never clicks inside the modal card. */
  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && !submitting) {
      onClose();
    }
  }

  async function submit() {
    if (name.trim().length === 0) {
      setError("Group name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/groups/${encodeURIComponent(group.groupId)}/rename`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name }),
        },
      );
      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }
      onClose();
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not rename the group.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return createPortal(
    <div className="admin-dialog-backdrop" onClick={handleBackdropClick}>
      <div
        aria-labelledby="rename-group-dialog-title"
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
              <h2 id="rename-group-dialog-title">Rename {group.name}</h2>
              <p>Choose a new name for the group.</p>
            </div>
          </div>
          <div className="admin-dialog-fields">
            <label className="admin-field">
              <span>Group name</span>
              <input
                maxLength={60}
                onChange={(event) => setName(event.target.value)}
                value={name}
              />
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
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="admin-primary-button"
              disabled={submitting || name.trim().length === 0}
              type="submit"
            >
              {submitting ? "Saving…" : "Save"}
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
