import { createLoadGroupDetailsHandler } from "../../../../../src/features/groups/group-route-handlers";
import { groupRuntime } from "../../../../../src/features/groups/group-runtime";

/** Returns one group's name, owner, member roster, and (for owners) the active invite link. */
export async function GET(
  request: Request,
  context: { params: Promise<{ groupId: string }> },
): Promise<Response> {
  const params = await context.params;
  return createLoadGroupDetailsHandler(
    {
      loadGroupDetails: groupRuntime.loadGroupDetails,
      loadIdentity: groupRuntime.loadIdentity,
      verifySession: groupRuntime.verifySession,
    },
    () => params.groupId,
  )(request);
}
