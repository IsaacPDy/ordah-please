import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { PublicApiError } from "@ordah-please/contracts";

const PUBLIC_TOKEN_PATTERN =
  /^invite\.v1\.([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})$/u;
const INVALID_INVITATION_MESSAGE = "This invitation link is invalid.";

export interface IssuedInvitationToken {
  readonly publicToken: string;
  readonly tokenHash: string;
}

/** Hashes a deployment identifier so invitation links can reject cross-environment use without exposing the identifier. */
function deploymentFingerprint(deploymentId: string): string {
  return createHash("sha256")
    .update(deploymentId)
    .digest()
    .subarray(0, 16)
    .toString("base64url");
}

/** Creates an unpredictable invitation token and the SHA-256 value that may be persisted. */
export function issueInvitationToken(
  deploymentId: string,
): IssuedInvitationToken {
  const publicToken = [
    "invite",
    "v1",
    deploymentFingerprint(deploymentId),
    randomBytes(32).toString("base64url"),
  ].join(".");

  return {
    publicToken,
    tokenHash: createHash("sha256").update(publicToken).digest("hex"),
  };
}

/** Validates a public invitation token for this deployment and reproduces its persistence hash. */
export function hashInvitationToken(
  publicToken: string,
  deploymentId: string,
): string {
  const match = PUBLIC_TOKEN_PATTERN.exec(publicToken);
  const tokenDeploymentFingerprint = match?.[1];
  if (tokenDeploymentFingerprint === undefined) {
    throw new PublicApiError("INVALID_INPUT", INVALID_INVITATION_MESSAGE);
  }

  const tokenDeployment = Buffer.from(tokenDeploymentFingerprint, "base64url");
  const expectedDeployment = Buffer.from(
    deploymentFingerprint(deploymentId),
    "base64url",
  );
  if (
    tokenDeployment.length !== expectedDeployment.length ||
    !timingSafeEqual(tokenDeployment, expectedDeployment)
  ) {
    throw new PublicApiError("INVALID_INPUT", INVALID_INVITATION_MESSAGE);
  }

  return createHash("sha256").update(publicToken).digest("hex");
}
