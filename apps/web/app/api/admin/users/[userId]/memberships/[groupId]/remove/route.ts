import { groupRuntime } from "../../../../../../../../src/features/groups/group-runtime";
import { createRemoveUserFromGroupHandler } from "../../../../../../../../src/features/users/users-admin-route-handlers";
import { usersRuntime } from "../../../../../../../../src/features/users/users-runtime";

/** Removes the user from a group. Platform Admin only. */
export async function POST(
  request: Request,
  context: { params: Promise<{ groupId: string; userId: string }> },
): Promise<Response> {
  const params = await context.params;
  return createRemoveUserFromGroupHandler(
    {
      removeUserFromGroupAsAdmin: usersRuntime.removeUserFromGroupAsAdmin,
      now: groupRuntime.now,
      loadIdentity: groupRuntime.loadIdentity,
      verifySession: groupRuntime.verifySession,
    },
    () => params.userId,
    () => params.groupId,
  )(request);
}
