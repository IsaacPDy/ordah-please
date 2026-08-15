"use client";

import { Users } from "lucide-react";
import { useState } from "react";

import { ArchiveGroupDialog } from "./archive-group-dialog";
import { RenameGroupDialog } from "./rename-group-dialog";

interface GroupsAdminRowProps {
  readonly group: {
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
      <span>0</span>
      <span className="status-pill">Active</span>
      <span>
        <button
          className="secondary-action"
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
          Archive
        </button>
      </span>
      {renameOpen ? (
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
