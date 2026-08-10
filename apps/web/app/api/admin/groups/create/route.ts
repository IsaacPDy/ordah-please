import { createAdminCreateGroupHandler } from "../../../../../src/features/groups/group-route-handlers";
import { groupRuntime } from "../../../../../src/features/groups/group-runtime";

/** Lets a Platform Admin create a new group with a chosen Owner and one fresh invite link. */
export function POST(request: Request): Promise<Response> {
  return createAdminCreateGroupHandler({
    createGroup: groupRuntime.createGroup,
    loadIdentity: groupRuntime.loadIdentity,
    verifySession: groupRuntime.verifySession,
  })(request);
}
