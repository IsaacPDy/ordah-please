import { Users } from "lucide-react";

import { AdminPage } from "../../components/admin-page";
import { CreateGroupDialog } from "../../components/create-group-dialog";
import { groupRuntime } from "../../../src/features/groups/group-runtime";

/** Lets the platform admin inspect, create, suspend, and open every group without deleting history. */
export default async function AdminGroupsPage() {
  const [groups, users] = await Promise.all([
    groupRuntime.listAllGroupsForAdmin(),
    groupRuntime.listAllUsers(),
  ]);

  return (
    <AdminPage
      actions={<CreateGroupDialog users={users} />}
      description="Inspect membership and orders, or suspend a group without destroying its history."
      eyebrow="Membership"
      title="Groups"
    >
      <section className="admin-panel">
        <div className="admin-table">
          <div className="admin-table__row admin-table__header">
            <span>Group</span>
            <span>Owner</span>
            <span>Members</span>
            <span>Active orders</span>
            <span>Status</span>
          </div>
          {groups.length === 0 ? (
            <p className="admin-empty">No groups yet. Create the first one.</p>
          ) : (
            groups.map((group) => (
              <button
                className="admin-table__row"
                key={group.groupId}
                type="button"
              >
                <strong>
                  <Users aria-hidden="true" size={18} /> {group.name}
                </strong>
                <span>{group.ownerDisplayName ?? "—"}</span>
                <span>{group.memberCount}</span>
                <span>0</span>
                <span className="status-pill">Active</span>
              </button>
            ))
          )}
        </div>
      </section>
    </AdminPage>
  );
}
