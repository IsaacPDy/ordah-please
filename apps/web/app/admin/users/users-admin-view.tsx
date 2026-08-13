"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import type { AdminUserSummary } from "../../../src/features/users/users-runtime";

const ROLE_LABELS: Readonly<Record<AdminUserSummary["memberships"][number]["role"], string>> = {
  "group-owner": "Group Owner",
  manager: "Manager",
  member: "Member",
};

interface UsersAdminViewProps {
  readonly users: readonly AdminUserSummary[];
}

/** Renders the admin user list and detail panel with client-side search and row selection. */
export function UsersAdminView({ users }: UsersAdminViewProps) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    users[0]?.id ?? null,
  );

  const visibleUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (normalized.length === 0) return users;
    return users.filter(
      (user) =>
        user.displayName.toLowerCase().includes(normalized) ||
        (user.email?.toLowerCase().includes(normalized) ?? false),
    );
  }, [query, users]);

  const effectiveSelectedId =
    selectedId !== null && visibleUsers.some((user) => user.id === selectedId)
      ? selectedId
      : (visibleUsers[0]?.id ?? null);
  const selected = users.find((user) => user.id === effectiveSelectedId) ?? null;

  return (
    <>
      <section className="admin-panel admin-list-panel">
        <label className="admin-search">
          <input
            aria-label="Search users"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name or email"
            type="search"
            value={query}
          />
        </label>
        {visibleUsers.length === 0 ? (
          <p className="admin-empty">
            {users.length === 0
              ? "No users yet."
              : `No users match "${query.trim()}".`}
          </p>
        ) : (
          <div className="admin-user-list">
            {visibleUsers.map((user) => (
              <button
                className={
                  user.id === effectiveSelectedId
                    ? "admin-user-row admin-user-row--active"
                    : "admin-user-row"
                }
                key={user.id}
                onClick={() => setSelectedId(user.id)}
                type="button"
              >
                <Avatar
                  displayName={user.displayName}
                  imageUrl={user.imageUrl}
                />
                <div>
                  <strong>{user.displayName}</strong>
                  <p>
                    {user.email ?? "—"} · {user.memberships.length}{" "}
                    {user.memberships.length === 1 ? "group" : "groups"}
                  </p>
                </div>
                {user.isPlatformAdmin ? (
                  <span className="status-pill">Platform Admin</span>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </section>
      {selected === null ? (
        <section className="admin-panel permission-panel">
          <p className="admin-empty">Select a user.</p>
        </section>
      ) : (
        <section className="admin-panel permission-panel">
          <div className="permission-panel__identity">
            <Avatar
              displayName={selected.displayName}
              imageUrl={selected.imageUrl}
            />
            <div>
              <h2>{selected.displayName}</h2>
              <p>{selected.email ?? "—"} · App active</p>
            </div>
            {selected.isPlatformAdmin ? (
              <span className="status-pill">Platform Admin</span>
            ) : null}
            <button
              className="secondary-action"
              disabled
              title="Coming soon"
              type="button"
            >
              Suspend account
            </button>
          </div>
          <div className="permission-groups">
            <h3>Group roles</h3>
            {selected.memberships.length === 0 ? (
              <p className="admin-empty">Not in any groups yet.</p>
            ) : (
              selected.memberships.map((membership) => (
                <div key={membership.groupId}>
                  <span>{membership.groupName}</span>
                  <strong>{ROLE_LABELS[membership.role]}</strong>
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </>
  );
}

interface AvatarProps {
  readonly displayName: string;
  readonly imageUrl: string | null;
}

function Avatar({ displayName, imageUrl }: AvatarProps) {
  if (imageUrl !== null && imageUrl.length > 0) {
    return (
      <Image
        alt=""
        className="member-avatar"
        height={44}
        src={imageUrl}
        unoptimized
        width={44}
      />
    );
  }
  const initial =
    displayName.length === 0
      ? "?"
      : displayName.charAt(0).toUpperCase();
  return <span className="member-avatar">{initial}</span>;
}
