import { createRotateInviteLinkHandler } from "../../../../../../src/features/groups/group-route-handlers";
import { groupRuntime } from "../../../../../../src/features/groups/group-runtime";

/** Rotates the persistent group invite link; route handler enforces group-owner authorization. */
export async function POST(
  request: Request,
  context: { params: Promise<{ groupId: string }> },
): Promise<Response> {
  const params = await context.params;
  return createRotateInviteLinkHandler(
    {
      rotateInviteLink: groupRuntime.rotateInviteLink,
      now: groupRuntime.now,
      loadIdentity: groupRuntime.loadIdentity,
      verifySession: groupRuntime.verifySession,
    },
    () => params.groupId,
  )(request);
}
