"use client";

import { Users } from "lucide-react";
import { useState } from "react";

import { ArchiveGroupDialog } from "./archive-group-dialog";
import { RenameGroupDialog } from "./rename-group-dialog";

interface GroupsAdminRowProps {
  readonly group: {
    readonly activeOrderCount: number;
    readonly archivedAt?: Date | null;
    readonly groupId: string;
    readonly name: string;
    readonly ownerDisplayName: string | null;
    readonly memberCount: number;
  };
}

/** Renders one admin group row with Rename and Archive actions. */
export function GroupsAdminRow({ group }: GroupsAdminRowProps) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  return (
    <div className="admin-table__row">
      <strong>
        <Users aria-hidden="true" size={18} /> {group.name}
      </strong>
      <span>{group.ownerDisplayName ?? "—"}</span>
      <span>{group.memberCount}</span>
      <span>{group.activeOrderCount}</span>
      <span className="status-pill">
        {group.archivedAt ? "Archived" : "Active"}
      </span>
      <span>
        <button
          className="secondary-action"
          disabled={!!group.archivedAt}
          onClick={() => setRenameOpen(true)}
          type="button"
        >
          Rename
        </button>
        <button
          className="secondary-action"
          onClick={() => setArchiveOpen(true)}
          type="button"
        >
          Delete
        </button>
      </span>
      {renameOpen && !group.archivedAt ? (
        <RenameGroupDialog
          group={{ groupId: group.groupId, name: group.name }}
          onClose={() => setRenameOpen(false)}
        />
      ) : null}
      {archiveOpen ? (
        <ArchiveGroupDialog
          group={{ groupId: group.groupId, name: group.name }}
          onClose={() => setArchiveOpen(false)}
        />
      ) : null}
    </div>
  );
}
