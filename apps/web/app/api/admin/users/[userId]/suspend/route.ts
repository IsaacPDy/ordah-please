import { groupRuntime } from "../../../../../../src/features/groups/group-runtime";
import { createSuspendUserHandler } from "../../../../../../src/features/users/users-admin-route-handlers";
import { usersRuntime } from "../../../../../../src/features/users/users-runtime";

/** Suspends a user (sets archivedAt). Platform Admin only. */
export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> },
): Promise<Response> {
  const params = await context.params;
  return createSuspendUserHandler(
    {
      suspendUserAsAdmin: usersRuntime.suspendUserAsAdmin,
      now: groupRuntime.now,
      loadIdentity: groupRuntime.loadIdentity,
      verifySession: groupRuntime.verifySession,
    },
    () => params.userId,
  )(request);
}
