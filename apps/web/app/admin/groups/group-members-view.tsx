"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface Member {
  userId: string;
  displayName: string;
  imageUrl: string | null;
  role: "owner" | "manager" | "member";
}
interface Group {
  id: string;
  name: string;
  archivedAt: Date | null;
  members: readonly Member[];
}

/** Renders a native modal with focus trapping, Escape, and backdrop dismissal. */
function MemberDialog({
  title,
  busy,
  onClose,
  children,
}: {
  title: string;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    const element = dialog.current;
    if (typeof element?.showModal === "function") element.showModal();
    else element?.setAttribute("open", "");
    return () => {
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  return createPortal(
    <dialog
      ref={dialog}
      className="admin-dialog admin-member-dialog"
      aria-label={title}
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            onClose();
        }
      }}
    >
      <h2>{title}</h2>
      {children}
    </dialog>,
    document.body,
  );
}

/** Admin roster cards. All writes refresh authoritative server data after success. */
export function GroupMembersView({
  group,
  users,
}: {
  group: Group;
  users: readonly { id: string; displayName: string }[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [personId, setPersonId] = useState("");
  const [removing, setRemoving] = useState<Member | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeIds = new Set(group.members.map((member) => member.userId));
  const available = users.filter((user) => !activeIds.has(user.id));
  const members = [...group.members].sort(
    (a, b) =>
      Number(b.role === "owner") - Number(a.role === "owner") ||
      a.displayName.localeCompare(b.displayName),
  );
  function close() {
    setAdding(false);
    setRemoving(null);
    setError(null);
  }
  async function mutate(url: string, body?: unknown) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(url, {
        method: "POST",
        ...(body === undefined
          ? {}
          : {
              headers: { "content-type": "application/json" },
              body: JSON.stringify(body),
            }),
      });
      if (!response.ok) {
        const result: unknown = await response.json();
        const message =
          result &&
          typeof result === "object" &&
          "error" in result &&
          result.error &&
          typeof result.error === "object" &&
          "message" in result.error &&
          typeof result.error.message === "string"
            ? result.error.message
            : "Could not save. Please try again.";
        throw new Error(message);
      }
      close();
      router.refresh();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not save. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const errorView = error ? (
    <p className="admin-error" role="alert">
      {error}
    </p>
  ) : null;
  return (
    <section className="admin-panel">
      <div className="admin-member-toolbar">
        <div>
          <h2>People</h2>
          <p>
            {group.members.length}{" "}
            {group.members.length === 1 ? "person" : "people"} in this group
          </p>
        </div>
        {!group.archivedAt ? (
          <button
            type="button"
            className="admin-primary-button"
            disabled={busy}
            onClick={() => {
              setPersonId("");
              setError(null);
              setAdding(true);
            }}
          >
            Add people
          </button>
        ) : null}
      </div>
      <p>
        Managers can log sessions, enter food details, and edit or delete this
        group&apos;s history. Only admins manage members and appoint managers.
      </p>
      {group.archivedAt ? (
        <p className="admin-empty">
          This group is archived. Membership is read-only.
        </p>
      ) : null}
      {!adding && !removing ? errorView : null}
      {members.length === 0 ? (
        <p className="admin-empty">No active members in this group.</p>
      ) : null}
      <div className="admin-member-grid">
        {members.map((member) => (
          <article
            className="admin-member-card"
            aria-label={member.displayName}
            key={member.userId}
          >
            <div className="admin-member-card__identity">
              <span className="admin-member-avatar">
                {member.imageUrl ? (
                  <Image
                    src={member.imageUrl}
                    alt=""
                    width={48}
                    height={48}
                    unoptimized
                  />
                ) : (
                  member.displayName
                    .split(/\s+/)
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()
                )}
              </span>
              <div>
                <h3>{member.displayName}</h3>
                <span className="status-pill">
                  {member.role === "owner"
                    ? "Group Owner"
                    : member.role === "manager"
                      ? "Manager"
                      : "Member"}
                </span>
              </div>
            </div>
            {!group.archivedAt && member.role !== "owner" ? (
              <div className="admin-member-card__actions">
                <button
                  type="button"
                  className="secondary-action"
                  disabled={busy}
                  onClick={() =>
                    void mutate(
                      `/api/admin/groups/${encodeURIComponent(group.id)}/members/${encodeURIComponent(member.userId)}/role`,
                      {
                        expectedRole: member.role,
                        role: member.role === "manager" ? "member" : "manager",
                      },
                    )
                  }
                >
                  {member.role === "manager"
                    ? "Remove manager role"
                    : "Appoint manager"}
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  disabled={busy}
                  onClick={() => {
                    setError(null);
                    setRemoving(member);
                  }}
                >
                  Remove from group
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
      {adding ? (
        <MemberDialog title="Add people" busy={busy} onClose={close}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (personId)
                void mutate(
                  `/api/admin/users/${encodeURIComponent(personId)}/memberships`,
                  { groupId: group.id },
                );
            }}
          >
            {available.length ? (
              <label className="admin-field">
                <span>Person</span>
                <select
                  required
                  disabled={busy}
                  value={personId}
                  onChange={(event) => setPersonId(event.target.value)}
                >
                  <option value="">Choose a person</option>
                  {available.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.displayName}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p>
                Everyone available is already in this group. Add new people in
                Users &amp; permissions first.
              </p>
            )}
            <p>
              People join as Members. You can appoint them as Managers
              afterward.
            </p>
            {errorView}
            <div className="admin-dialog-actions">
              <button
                type="button"
                className="admin-secondary-button"
                disabled={busy}
                onClick={close}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="admin-primary-button"
                disabled={busy || !personId}
              >
                {busy ? "Adding…" : "Add to group"}
              </button>
            </div>
          </form>
        </MemberDialog>
      ) : null}
      {removing ? (
        <MemberDialog
          title={`Remove ${removing.displayName} from ${group.name}?`}
          busy={busy}
          onClose={close}
        >
          <p>
            They will lose access to this group. Saved session history is kept.
          </p>
          {errorView}
          <div className="admin-dialog-actions">
            <button
              className="admin-secondary-button"
              type="button"
              disabled={busy}
              onClick={close}
            >
              Cancel
            </button>
            <button
              className="admin-danger-button"
              type="button"
              disabled={busy}
              onClick={() =>
                void mutate(
                  `/api/admin/users/${encodeURIComponent(removing.userId)}/memberships/${encodeURIComponent(group.id)}/remove`,
                )
              }
            >
              {busy ? "Removing…" : "Remove"}
            </button>
          </div>
        </MemberDialog>
      ) : null}
    </section>
  );
}
