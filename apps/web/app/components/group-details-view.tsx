"use client";

import { useState } from "react";
import { Crown, ShieldCheck, User, UserPlus } from "lucide-react";

import type { GroupDetails } from "@ordah-please/domain";

export interface GroupDetailsViewProps {
  readonly details: GroupDetails;
  readonly canManage: boolean;
}

/** Renders one group's name, a single roster with the owner pinned first, and management actions. */
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

  const nonOwnerMembers = details.members.filter(
    (member) => member.userId !== details.owner.userId,
  );
  const totalPeople = details.members.length;

  return (
    <section className="member-page">
      <header className="page-intro group-details-header">
        <span className="group-details-header__icon" aria-hidden="true">
          {initialsOf(details.name)}
        </span>
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
          <div className="group-details-header__title">
            <h1>{details.name}</h1>
            <p>
              {totalPeople} {totalPeople === 1 ? "person" : "people"}
            </p>
            {canManage ? (
              <button
                aria-label="Rename group"
                className="icon-button group-details-header__rename"
                onClick={() => setEditing(true)}
                type="button"
              >
                ✏️
              </button>
            ) : null}
          </div>
        )}
        {renameError !== null ? (
          <p role="alert" className="form-error">
            {renameError}
          </p>
        ) : null}
      </header>

      <ul className="group-roster">
        <li className="group-roster__item group-roster__item--owner">
          <span className="group-roster__avatar" aria-hidden="true">
            <Crown size={16} />
          </span>
          <span className="group-roster__name">{details.owner.displayName}</span>
          <span className="role-pill role-pill--owner">Owner</span>
        </li>
        {nonOwnerMembers.map((member) => (
          <li key={member.userId} className="group-roster__item">
            <span className="group-roster__avatar" aria-hidden="true">
              <RoleIcon role={member.role} />
            </span>
            <span className="group-roster__name">{member.displayName}</span>
            <span
              className={
                member.role === "manager"
                  ? "role-pill"
                  : "role-pill role-pill--member"
              }
            >
              {roleLabel(member.role)}
            </span>
          </li>
        ))}
      </ul>

      {canManage && inviteLink !== undefined ? (
        <div className="group-details-manage">
          <button
            className="add-people-button"
            onClick={() => {
              void copyLink();
            }}
            type="button"
          >
            <UserPlus aria-hidden="true" size={16} />
            {copied ? "Link copied" : "Add people"}
          </button>
          <p className="group-details-manage__hint">
            Anyone with the link can join. Link ends in{" "}
            <code>{inviteLink.tokenPrefix}…</code>
          </p>
          <button
            className="secondary-button group-details-manage__rotate"
            disabled={rotating}
            onClick={() => {
              void rotateLink();
            }}
            type="button"
          >
            {rotating ? "Rotating…" : "Rotate link"}
          </button>
          {rotateError !== null ? (
            <p role="alert" className="form-error">
              {rotateError}
            </p>
          ) : null}
        </div>
      ) : null}
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

/** Returns up to two uppercase initials from a group name for the icon badge. */
function initialsOf(name: string): string {
  const cleaned = name.trim();
  if (cleaned.length === 0) {
    return "G";
  }
  const parts = cleaned.split(/\s+/).filter((part) => part.length > 0);
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}
