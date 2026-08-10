import { createAcceptInviteLinkHandler } from "../../../../../src/features/groups/group-route-handlers";
import { groupRuntime } from "../../../../../src/features/groups/group-runtime";

/** Accepts one persistent invite link into group membership; old single-use tokens return safe CONFLICT. */
export function POST(request: Request): Promise<Response> {
  return createAcceptInviteLinkHandler({
    acceptInviteLink: groupRuntime.acceptInviteLink,
    loadIdentity: groupRuntime.loadIdentity,
    now: groupRuntime.now,
    verifySession: groupRuntime.verifySession,
  })(request);
}
