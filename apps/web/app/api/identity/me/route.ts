import { createIdentityMeHandler } from "../../../../src/features/access/access-route-handlers";
import { accessRuntime } from "../../../../src/features/access/access-runtime";

export const GET = createIdentityMeHandler({
  countPendingAdminRequests: accessRuntime.listPendingAdminRequests,
  loadIdentity: accessRuntime.loadIdentity,
  verifySession: accessRuntime.verifySession,
});
