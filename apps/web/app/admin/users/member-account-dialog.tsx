"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { AdminUserSummary } from "../../../src/features/users/users-runtime";

export function MemberAccountDialog({
  member,
  users,
}: {
  readonly member?: AdminUserSummary;
  readonly users: readonly AdminUserSummary[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const accounts = users.filter((user) => user.email !== null);
  useEffect(() => {
    if (!open || !dialog.current) return;
    const element = dialog.current;
    // Native modal semantics trap focus, support Escape, and isolate the background.
    if (typeof element.showModal === "function") element.showModal();
    else element.setAttribute("open", "");
    return () => trigger.current?.focus();
  }, [open]);

  async function save() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(
        member ? `/api/admin/users/${member.id}/link` : "/api/admin/users",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            member ? { accountUserId: value } : { displayName: value.trim() },
          ),
        },
      );
      const result: unknown = await response.json();
      if (!response.ok)
        throw new Error(
          typeof result === "object" &&
            result !== null &&
            "error" in result &&
            typeof result.error === "object" &&
            result.error !== null &&
            "message" in result.error &&
            typeof result.error.message === "string"
            ? result.error.message
            : "Could not save. Please try again.",
        );
      setOpen(false);
      router.refresh();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not save. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        className={member ? "secondary-action" : "primary-action"}
        ref={trigger}
        type="button"
        onClick={() => {
          setValue("");
          setError(null);
          setOpen(true);
        }}
      >
        {member ? "Link login account" : "Add member"}
      </button>
      {open
        ? createPortal(
            <dialog
              className="admin-dialog member-account-dialog"
              ref={dialog}
              aria-labelledby="member-account-title"
              onCancel={(event) => {
                if (submitting) event.preventDefault();
                else setOpen(false);
              }}
              onClick={(event) => {
                if (event.target !== event.currentTarget || submitting) return;
                const rect = event.currentTarget.getBoundingClientRect();
                if (
                  event.clientX < rect.left ||
                  event.clientX > rect.right ||
                  event.clientY < rect.top ||
                  event.clientY > rect.bottom
                )
                  setOpen(false);
              }}
            >
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void save();
                }}
              >
                <div className="admin-dialog-header">
                  <div>
                    <h2 id="member-account-title">
                      {member ? `Link ${member.displayName}` : "Add member"}
                    </h2>
                    <p>
                      {member
                        ? "Choose this person's signed-in account. Their groups and order history will be combined. The account's name and email will be used."
                        : "Add someone before they sign in. You can add them to groups and orders, then link their login later."}
                    </p>
                  </div>
                </div>
                <div className="admin-dialog-fields">
                  {member ? (
                    <label className="admin-field">
                      <span>Signed-in account</span>
                      <select
                        value={value}
                        disabled={submitting || accounts.length === 0}
                        required
                        onChange={(event) => setValue(event.target.value)}
                      >
                        <option value="">Choose an account</option>
                        {accounts.length === 0 ? (
                          <option value="">No signed-in accounts yet</option>
                        ) : (
                          accounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.displayName} · {account.email}
                            </option>
                          ))
                        )}
                      </select>
                    </label>
                  ) : (
                    <label className="admin-field">
                      <span>Member name</span>
                      <input
                        autoFocus
                        maxLength={120}
                        required
                        value={value}
                        disabled={submitting}
                        onChange={(event) => setValue(event.target.value)}
                      />
                    </label>
                  )}
                  {error ? (
                    <p className="admin-error" role="alert">
                      {error}
                    </p>
                  ) : null}
                </div>
                <div className="admin-dialog-actions">
                  <button
                    className="secondary-action"
                    type="button"
                    disabled={submitting}
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="primary-action"
                    type="submit"
                    disabled={submitting || value.trim().length === 0}
                  >
                    {submitting
                      ? "Saving…"
                      : member
                        ? "Confirm link"
                        : "Save member"}
                  </button>
                </div>
              </form>
            </dialog>,
            document.body,
          )
        : null}
    </>
  );
}
