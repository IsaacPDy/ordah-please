import { createDecideAdminRequestHandler } from "../../../../../src/features/access/access-route-handlers";
import { accessRuntime } from "../../../../../src/features/access/access-runtime";

export const POST = createDecideAdminRequestHandler({
  decideAdminRequest: accessRuntime.decideAdminRequest,
  loadIdentity: accessRuntime.loadIdentity,
  now: () => new Date(),
  verifySession: accessRuntime.verifySession,
});
