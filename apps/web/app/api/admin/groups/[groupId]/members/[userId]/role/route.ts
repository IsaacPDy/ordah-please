import { groupRuntime } from "../../../../../../../../src/features/groups/group-runtime";
import { createSetGroupMemberRoleHandler } from "../../../../../../../../src/features/groups/groups-admin-route-handlers";

export async function POST(
  request: Request,
  context: { params: Promise<{ groupId: string; userId: string }> },
) {
  const { groupId, userId } = await context.params;
  return createSetGroupMemberRoleHandler(
    groupRuntime,
    () => groupId,
    () => userId,
  )(request);
}
