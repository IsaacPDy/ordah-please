import { AdminPage } from "../../components/admin-page";
import { CreateGroupDialog } from "../../components/create-group-dialog";
import { groupRuntime } from "../../../src/features/groups/group-runtime";

import { GroupsAdminRow } from "./groups-admin-row";

/** Lets the platform admin inspect, create, rename, and archive every group without deleting history. */
export default async function AdminGroupsPage() {
  const [groups, users] = await Promise.all([
    groupRuntime.listAllGroupsForAdmin(),
    groupRuntime.listAllUsers(),
  ]);

  return (
    <AdminPage
      actions={<CreateGroupDialog users={users} />}
      description="Inspect membership and orders, or archive a group without destroying its history."
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
            <span>Actions</span>
          </div>
          {groups.length === 0 ? (
            <p className="admin-empty">No groups yet. Create the first one.</p>
          ) : (
            groups.map((group) => (
              <GroupsAdminRow group={group} key={group.groupId} />
            ))
          )}
        </div>
      </section>
    </AdminPage>
  );
}
