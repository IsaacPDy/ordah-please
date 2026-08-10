import { createRenameGroupHandler } from "../../../../../src/features/groups/group-route-handlers";
import { groupRuntime } from "../../../../../src/features/groups/group-runtime";

/** Renames one group; route handler enforces group-owner authorization. */
export async function POST(
  request: Request,
  context: { params: Promise<{ groupId: string }> },
): Promise<Response> {
  const params = await context.params;
  return createRenameGroupHandler(
    {
      renameGroup: groupRuntime.renameGroup,
      now: groupRuntime.now,
      loadIdentity: groupRuntime.loadIdentity,
      verifySession: groupRuntime.verifySession,
    },
    () => params.groupId,
  )(request);
}
