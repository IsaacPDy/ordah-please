"use client";

import type { MouseEvent } from "react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

interface ArchiveGroupDialogProps {
  readonly group: { readonly groupId: string; readonly name: string };
  readonly onClose: () => void;
}

/** Confirmation modal for a Platform Admin to archive one group. */
export function ArchiveGroupDialog({
  group,
  onClose,
}: ArchiveGroupDialogProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Handles only true backdrop clicks, never clicks inside the modal card. */
  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && !submitting) {
      onClose();
    }
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/groups/${encodeURIComponent(group.groupId)}/delete`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ confirmed: true }),
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
          : "Could not delete the group.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return createPortal(
    <div className="admin-dialog-backdrop" onClick={handleBackdropClick}>
      <div
        aria-labelledby="archive-group-dialog-title"
        aria-modal="true"
        className="admin-dialog"
        role="dialog"
      >
        <div className="admin-dialog-confirmation">
          <div>
            <h2 id="archive-group-dialog-title">
              Permanently delete {group.name}?
            </h2>
            <p>
              This permanently removes the group from every profile and deletes
              all of its sessions, order history, participants, and saved food
              details. This cannot be undone.
            </p>
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
              className="admin-danger-button"
              disabled={submitting}
              onClick={() => void submit()}
              type="button"
            >
              {submitting ? "Deleting…" : "Delete group permanently"}
            </button>
          </div>
        </div>
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
