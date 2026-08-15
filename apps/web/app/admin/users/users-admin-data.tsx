import { groupRuntime } from "../../../src/features/groups/group-runtime";
import { usersRuntime } from "../../../src/features/users/users-runtime";

import { UsersAdminView } from "./users-admin-view";

/** Fetches the admin user list and active groups, renders the interactive view inside the page's Suspense boundary. */
export async function UsersAdminData() {
  const [users, groups] = await Promise.all([
    usersRuntime.listUsersForAdmin(),
    groupRuntime.listAllGroupsForAdmin(),
  ]);
  return (
    <UsersAdminView
      groups={groups.map((group) => ({
        groupId: group.groupId,
        name: group.name,
      }))}
      users={users}
    />
  );
}
