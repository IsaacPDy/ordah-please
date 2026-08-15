import { createRenameGroupAsAdminHandler } from "../../../../../../src/features/groups/groups-admin-route-handlers";
import { groupRuntime } from "../../../../../../src/features/groups/group-runtime";

/** Renames a group as Platform Admin (bypasses the group-owner check). */
export async function POST(
  request: Request,
  context: { params: Promise<{ groupId: string }> },
): Promise<Response> {
  const params = await context.params;
  return createRenameGroupAsAdminHandler(
    {
      renameGroupAsAdmin: groupRuntime.renameGroupAsAdmin,
      loadIdentity: groupRuntime.loadIdentity,
      verifySession: groupRuntime.verifySession,
    },
    () => params.groupId,
  )(request);
}
