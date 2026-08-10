"use client";

import { useState } from "react";
import { Crown, ShieldCheck, User } from "lucide-react";

import type { GroupDetails } from "@ordah-please/domain";

export interface GroupDetailsViewProps {
  readonly details: GroupDetails;
  readonly canManage: boolean;
}

/** Renders one group's name, owner, roster, and (for owners) the rename and rotate-link controls. */
export function GroupDetailsView({ details, canManage }: GroupDetailsViewProps) {
  const [name, setName] = useState(details.name);
  const [editing, setEditing] = useState(false);
  const [savingRename, setSavingRename] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState(details.inviteLink);
  const [rotating, setRotating] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function saveRename() {
    setSavingRename(true);
    setRenameError(null);
    try {
      const response = await fetch(`/api/groups/${details.groupId}/rename`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }
      setEditing(false);
    } catch (error) {
      setRenameError(error instanceof Error ? error.message : "Rename failed.");
    } finally {
      setSavingRename(false);
    }
  }

  async function rotateLink() {
    if (
      !window.confirm(
        "Rotate the invite link? The current link will stop working immediately.",
      )
    ) {
      return;
    }
    setRotating(true);
    setRotateError(null);
    try {
      const response = await fetch(
        `/api/groups/${details.groupId}/invite-link/rotate`,
        { method: "POST" },
      );
      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }
      const body = (await response.json()) as {
        result: { publicValue: string; tokenPrefix: string };
      };
      setInviteLink({
        publicValue: body.result.publicValue,
        tokenPrefix: body.result.tokenPrefix,
      });
    } catch (error) {
      setRotateError(
        error instanceof Error ? error.message : "Rotation failed.",
      );
    } finally {
      setRotating(false);
    }
  }

  async function copyLink() {
    if (inviteLink === undefined) return;
    try {
      await navigator.clipboard.writeText(inviteLink.publicValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setRotateError("Could not copy the link.");
    }
  }

  /** Reads the safe public message from a failed response, or returns a fallback. */
  async function readErrorMessage(response: Response): Promise<string> {
    try {
      const body = (await response.json()) as {
        error?: { message?: unknown };
      };
      const message = body?.error?.message;
      return typeof message === "string" ? message : "Request failed.";
    } catch {
      return "Request failed.";
    }
  }

  return (
    <section className="member-page">
      <header className="page-intro">
        <p className="eyebrow">{roleLabel(details.viewerRole)} view</p>
        {editing && canManage ? (
          <div className="rename-row">
            <input
              aria-label="Group name"
              className="rename-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={60}
            />
            <button
              className="primary-button"
              disabled={savingRename}
              onClick={() => {
                void saveRename();
              }}
              type="button"
            >
              {savingRename ? "Saving…" : "Save"}
            </button>
            <button
              className="secondary-button"
              disabled={savingRename}
              onClick={() => {
                setName(details.name);
                setEditing(false);
                setRenameError(null);
              }}
              type="button"
            >
              Cancel
            </button>
          </div>
        ) : (
          <h1>
            {details.name}
            {canManage ? (
              <button
                aria-label="Rename group"
                className="icon-button"
                onClick={() => setEditing(true)}
                type="button"
              >
                ✏️
              </button>
            ) : null}
          </h1>
        )}
        {renameError !== null ? (
          <p role="alert" className="form-error">
            {renameError}
          </p>
        ) : null}
      </header>

      <div className="details-grid">
        <article className="details-card">
          <h2>Owner</h2>
          <p>
            <Crown aria-hidden="true" size={16} /> {details.owner.displayName}
          </p>
        </article>
        <article className="details-card">
          <h2>Members</h2>
          <ul className="member-roster">
            {details.members.map((member) => (
              <li key={member.userId}>
                <RoleIcon role={member.role} />
                <span>{member.displayName}</span>
                <span className="role-pill">{roleLabel(member.role)}</span>
              </li>
            ))}
          </ul>
        </article>
        {canManage && inviteLink !== undefined ? (
          <article className="details-card">
            <h2>Invite link</h2>
            <p className="invite-prefix">
              Anyone with this link can join the group. Link ends in{" "}
              <code>{inviteLink.tokenPrefix}…</code>
            </p>
            <div className="invite-actions">
              <button
                className="primary-button"
                onClick={() => {
                  void copyLink();
                }}
                type="button"
              >
                {copied ? "Copied" : "Copy link"}
              </button>
              <button
                className="secondary-button"
                disabled={rotating}
                onClick={() => {
                  void rotateLink();
                }}
                type="button"
              >
                {rotating ? "Rotating…" : "Rotate link"}
              </button>
            </div>
            {rotateError !== null ? (
              <p role="alert" className="form-error">
                {rotateError}
              </p>
            ) : null}
          </article>
        ) : null}
      </div>
    </section>
  );
}

function roleLabel(role: string): string {
  if (role === "group-owner") {
    return "Group Owner";
  }
  if (role === "manager") {
    return "Manager";
  }
  return "Member";
}

function RoleIcon({ role }: { readonly role: string }) {
  if (role === "group-owner") {
    return <Crown aria-hidden="true" size={14} />;
  }
  if (role === "manager") {
    return <ShieldCheck aria-hidden="true" size={14} />;
  }
  return <User aria-hidden="true" size={14} />;
}
