import { usersRuntime } from "../../../src/features/users/users-runtime";

import { UsersAdminView } from "./users-admin-view";

/** Fetches the admin user list and renders the interactive view inside the page's Suspense boundary. */
export async function UsersAdminData() {
  const users = await usersRuntime.listUsersForAdmin();
  return <UsersAdminView users={users} />;
}
