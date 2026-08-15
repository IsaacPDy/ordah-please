"use client";

import type { MouseEvent } from "react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import type {
  AdminUserMembership,
  AdminUserSummary,
} from "../../../src/features/users/users-runtime";

interface ConfirmRemoveMembershipDialogProps {
  readonly user: AdminUserSummary;
  readonly membership: AdminUserMembership;
  readonly open: boolean;
  readonly onClose: () => void;
}

/** Confirmation modal for a Platform Admin to remove one user's group membership. */
export function ConfirmRemoveMembershipDialog({
  user,
  membership,
  open,
  onClose,
}: ConfirmRemoveMembershipDialogProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return null;
  }

  /** Clears temporary state and notifies the parent that the modal closed. */
  function close() {
    setError(null);
    setSubmitting(false);
    onClose();
  }

  /** Handles only true backdrop clicks, never clicks inside the modal card. */
  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && !submitting) {
      close();
    }
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(user.id)}/memberships/${encodeURIComponent(membership.groupId)}/remove`,
        { method: "POST" },
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
          : "Could not remove the user from the group.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return createPortal(
    <div className="admin-dialog-backdrop" onClick={handleBackdropClick}>
      <div
        aria-labelledby="confirm-remove-membership-dialog-title"
        aria-modal="true"
        className="admin-dialog"
        role="dialog"
      >
        <div className="admin-dialog-confirmation">
          <div>
            <h2 id="confirm-remove-membership-dialog-title">
              Remove {user.displayName} from {membership.groupName}?
            </h2>
            <p>They&apos;ll need a new invite to rejoin.</p>
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
              className="admin-danger-button"
              disabled={submitting}
              onClick={() => void submit()}
              type="button"
            >
              {submitting ? "Removing…" : "Remove"}
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
