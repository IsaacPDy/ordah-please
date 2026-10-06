import { groupRuntime } from "../../../../../../src/features/groups/group-runtime";
import { createMemberAccountHandler } from "../../../../../../src/features/users/users-admin-route-handlers";
import { usersRuntime } from "../../../../../../src/features/users/users-runtime";

export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> },
): Promise<Response> {
  const params = await context.params;
  return createMemberAccountHandler(
    {
      createMemberAsAdmin: usersRuntime.createMemberAsAdmin,
      linkMemberAsAdmin: usersRuntime.linkMemberAsAdmin,
      loadIdentity: groupRuntime.loadIdentity,
      verifySession: groupRuntime.verifySession,
    },
    params.userId,
  )(request);
}
