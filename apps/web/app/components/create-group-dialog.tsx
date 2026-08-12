"use client";

import { X } from "lucide-react";
import type { KeyboardEvent, MouseEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface CreateGroupDialogProps {
  readonly users: readonly {
    readonly id: string;
    readonly displayName: string;
  }[];
}

/** Modal form for a Platform Admin to create a new group with a name and chosen Owner. */
export function CreateGroupDialog({ users }: CreateGroupDialogProps) {
  const initialOwnerId = users[0]?.id ?? "";
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [ownerId, setOwnerId] = useState(initialOwnerId);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [wobbling, setWobbling] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);
  const isDirty = name.length > 0 || ownerId !== initialOwnerId;

  useEffect(() => {
    if (open) {
      if (confirmingDiscard) {
        keepEditingRef.current?.focus();
      } else {
        nameInputRef.current?.focus();
      }
    } else if (wasOpenRef.current) {
      triggerRef.current?.focus();
    }
    wasOpenRef.current = open;
  }, [confirmingDiscard, open]);

  /** Clears every temporary value so the next modal starts fresh. */
  function reset() {
    setName("");
    setOwnerId(initialOwnerId);
    setError(null);
    setConfirmingDiscard(false);
    setWobbling(false);
  }

  /** Closes the modal and removes any unfinished form values. */
  function closeAndReset() {
    setOpen(false);
    reset();
  }

  /** Closes a clean form or asks before throwing away changed fields. */
  function requestClose() {
    if (isDirty) {
      setConfirmingDiscard(true);
      return;
    }

    closeAndReset();
  }

  /** Handles only true backdrop clicks, never clicks inside the modal card. */
  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) {
      return;
    }

    if (isDirty) {
      setWobbling(true);
      return;
    }

    closeAndReset();
  }

  /** Keeps keyboard focus inside the modal and gives Escape safe close behavior. */
  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (submitting) return;
      if (confirmingDiscard) {
        setConfirmingDiscard(false);
      } else {
        requestClose();
      }
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /** Validates the form and creates the group through the protected admin API. */
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
      closeAndReset();
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
        ref={triggerRef}
        type="button"
      >
        Create group
      </button>
    );
  }

  return createPortal(
    <div
      className="admin-dialog-backdrop"
      data-testid="create-group-backdrop"
      onClick={handleBackdropClick}
    >
      <div
        aria-labelledby="create-group-dialog-title"
        aria-modal="true"
        className={`admin-dialog${wobbling ? " admin-dialog--wobble" : ""}`}
        onAnimationEnd={() => setWobbling(false)}
        onKeyDown={handleDialogKeyDown}
        ref={dialogRef}
        role="dialog"
      >
        {confirmingDiscard ? (
          <div className="admin-dialog-confirmation">
            <div>
              <h2 id="create-group-dialog-title">Discard this group?</h2>
              <p>Your group details have not been saved.</p>
            </div>
            <div className="admin-dialog-actions">
              <button
                className="admin-secondary-button"
                onClick={() => setConfirmingDiscard(false)}
                ref={keepEditingRef}
                type="button"
              >
                Keep editing
              </button>
              <button
                className="admin-danger-button"
                onClick={closeAndReset}
                type="button"
              >
                Discard
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <div className="admin-dialog-header">
              <div>
                <h2 id="create-group-dialog-title">Create group</h2>
                <p>Add a group and choose its first Group Owner.</p>
              </div>
              <button
                aria-label="Close"
                className="admin-dialog-close"
                disabled={submitting}
                onClick={requestClose}
                type="button"
              >
                <X aria-hidden="true" size={20} />
              </button>
            </div>
            <div className="admin-dialog-fields">
              <label className="admin-field">
                <span>Group name</span>
                <input
                  maxLength={60}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Friday Lunch Club"
                  ref={nameInputRef}
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
            </div>
            <div className="admin-dialog-actions">
              <button
                className="admin-primary-button"
                disabled={submitting}
                type="submit"
              >
                {submitting ? "Creating…" : "Create group"}
              </button>
            </div>
          </form>
        )}
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
    return "Request failed.";
  }
}
