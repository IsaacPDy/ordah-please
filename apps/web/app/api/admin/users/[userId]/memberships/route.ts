import { groupRuntime } from "../../../../../../src/features/groups/group-runtime";
import { createAddUserToGroupHandler } from "../../../../../../src/features/users/users-admin-route-handlers";
import { usersRuntime } from "../../../../../../src/features/users/users-runtime";

/** Adds the user to a group as a Member. Platform Admin only. */
export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> },
): Promise<Response> {
  const params = await context.params;
  return createAddUserToGroupHandler(
    {
      addUserToGroupAsAdmin: usersRuntime.addUserToGroupAsAdmin,
      loadIdentity: groupRuntime.loadIdentity,
      verifySession: groupRuntime.verifySession,
    },
    () => params.userId,
  )(request);
}
