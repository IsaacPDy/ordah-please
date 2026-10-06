"use client";

import { useState } from "react";
import { Pencil, UserPlus, Plus, Users } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

import { SessionCard } from "./session-card";
import { OrderHistoryList } from "../(member)/orders/order-history-list";
import type { OrderSummaryPage } from "../../src/features/orders/orders-service";
import type { GroupDetails } from "@ordah-please/domain";

export interface GroupDetailsViewProps {
  readonly details: GroupDetails;
  readonly canManage: boolean;
  readonly canStartOrder?: boolean;
  readonly summaries?: OrderSummaryPage;
}

/** Renders one group's name, a single roster with the owner pinned first, and management actions. */
export function GroupDetailsView({
  details,
  canManage,
  canStartOrder = canManage,
  summaries = { active: [], history: [], nextCursor: null },
}: GroupDetailsViewProps) {
  const [tab, setTab] = useState("overview");
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
    <section className="member-page group-detail-page">
      <div className="group-cover" aria-hidden="true">
        <Users size={54} strokeWidth={1.5} />
      </div>
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
            <p className="eyebrow">
              {totalPeople} {totalPeople === 1 ? "member" : "members"} · You’re
              a {roleLabel(details.viewerRole)}
            </p>
            <h1>{details.name}</h1>
            {canManage ? (
              <button
                aria-label="Rename group"
                className="icon-button group-details-header__rename"
                onClick={() => setEditing(true)}
                type="button"
              >
                <Pencil aria-hidden="true" size={16} />
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

      <div className="segmented-control" aria-label="Group sections">
        {["overview", "history", "members"].map((value) => (
          <button
            type="button"
            aria-pressed={tab === value}
            key={value}
            onClick={() => setTab(value)}
          >
            {value.charAt(0).toUpperCase() + value.slice(1)}
          </button>
        ))}
      </div>
      {tab === "overview" ? (
        <>
          <section className="content-section">
            <div className="section-heading-row">
              <h2>Current order</h2>
            </div>
            {summaries.active[0] ? (
              <SessionCard order={summaries.active[0]} />
            ) : (
              <p className="restaurant-empty">
                No active order for this group.
              </p>
            )}
          </section>
          {canStartOrder ? (
            <Link
              className="primary-action"
              href={`/orders/new?groupId=${encodeURIComponent(details.groupId)}`}
            >
              <Plus size={18} aria-hidden="true" />
              Start a new order
            </Link>
          ) : null}
          <section className="content-section group-recent-orders">
            {summaries.history.length ? (
              <OrderHistoryList
                heading="Recent orders"
                headingAction={
                  <button
                    className="text-action"
                    type="button"
                    onClick={() => setTab("history")}
                  >
                    See all
                  </button>
                }
                extendedFilters={false}
                groupId={details.groupId}
                initialHistory={summaries.history.slice(0, 3)}
                initialNextCursor={null}
              />
            ) : (
              <p className="restaurant-empty">
                Completed orders will appear here.
              </p>
            )}
          </section>
        </>
      ) : null}
      {tab === "history" ? (
        <section
          className="group-history-panel"
          aria-label="Group order history"
        >
          {summaries.history.length || summaries.nextCursor ? (
            <OrderHistoryList
              heading="Order history"
              initialHistory={summaries.history}
              initialNextCursor={summaries.nextCursor}
              groupId={details.groupId}
            />
          ) : (
            <p className="restaurant-empty">
              Completed orders will appear here.
            </p>
          )}
        </section>
      ) : null}
      <div className="group-members-panel" hidden={tab !== "members"}>
        <ul className="group-roster">
          <li className="group-roster__item group-roster__item--owner">
            <RosterAvatar
              name={details.owner.displayName}
              imageUrl={details.owner.imageUrl ?? null}
            />
            <span className="group-roster__identity">
              <span className="group-roster__name">
                {details.owner.displayName}
              </span>
              <small>Group Owner</small>
            </span>
            <span className="role-pill role-pill--owner">Owner</span>
          </li>
          {nonOwnerMembers.map((member) => (
            <li key={member.userId} className="group-roster__item">
              <RosterAvatar
                name={member.displayName}
                imageUrl={member.imageUrl ?? null}
              />
              <span className="group-roster__identity">
                <span className="group-roster__name">{member.displayName}</span>
                <small>Joined this group</small>
              </span>
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
            <h2>Group actions</h2>
            <button
              className="add-people-button"
              onClick={() => {
                void copyLink();
              }}
              type="button"
            >
              <UserPlus aria-hidden="true" size={16} />
              {copied ? "Link copied" : "Copy invite link"}
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
      </div>
    </section>
  );
}

/** Shows the account photo, with initials only when no usable photo is available. */
function RosterAvatar({
  name,
  imageUrl,
}: {
  name: string;
  imageUrl?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="group-roster__avatar">
      {imageUrl && !failed ? (
        <Image
          src={imageUrl}
          alt={`${name}'s profile photo`}
          width={44}
          height={44}
          unoptimized
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden="true">{initialsOf(name)}</span>
      )}
    </span>
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
