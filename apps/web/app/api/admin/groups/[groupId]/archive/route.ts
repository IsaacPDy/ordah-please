import { createArchiveGroupHandler } from "../../../../../../src/features/groups/groups-admin-route-handlers";
import { groupRuntime } from "../../../../../../src/features/groups/group-runtime";

/** Archives a group (sets archivedAt). Platform Admin only. */
export async function POST(
  request: Request,
  context: { params: Promise<{ groupId: string }> },
): Promise<Response> {
  const params = await context.params;
  return createArchiveGroupHandler(
    {
      archiveGroupAsAdmin: groupRuntime.archiveGroupAsAdmin,
      now: groupRuntime.now,
      loadIdentity: groupRuntime.loadIdentity,
      verifySession: groupRuntime.verifySession,
    },
    () => params.groupId,
  )(request);
}
