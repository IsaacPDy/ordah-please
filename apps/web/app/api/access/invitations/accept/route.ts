import { createAcceptInvitationHandler } from "../../../../../src/features/access/access-route-handlers";
import {
  accessRuntime,
  readDeploymentId,
} from "../../../../../src/features/access/access-runtime";

export const POST = createAcceptInvitationHandler({
  ...accessRuntime,
  deploymentId: readDeploymentId(),
  now: () => new Date(),
});
