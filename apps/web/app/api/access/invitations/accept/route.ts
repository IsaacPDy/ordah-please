import { createAcceptInvitationHandler } from "../../../../../src/features/access/access-route-handlers";
import {
  accessRuntime,
  readDeploymentId,
} from "../../../../../src/features/access/access-runtime";

/** Resolves deployment-bound invitation configuration only when a runtime request arrives. */
export function POST(request: Request): Promise<Response> {
  return createAcceptInvitationHandler({
    ...accessRuntime,
    deploymentId: readDeploymentId(),
    now: () => new Date(),
  })(request);
}
