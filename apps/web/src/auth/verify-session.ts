import { PublicApiError } from "@ordah-please/contracts";

import { getServerAuth } from "./server-auth";

export interface BetterAuthSessionState {
  readonly session: {
    readonly expiresAt: Date;
    readonly id: string;
  };
  readonly user: {
    readonly email: string;
    readonly id: string;
    readonly name: string;
  };
}

export type ReadBetterAuthSession = (input: {
  readonly headers: Headers;
}) => Promise<BetterAuthSessionState | null>;

export interface VerifiedSession {
  readonly authUserId: string;
  readonly displayName: string;
}

/** Rejects requests without a live Better Auth session and returns trusted identity fields only. */
export async function verifySession(
  request: Request,
  readSession: ReadBetterAuthSession = ({ headers }) =>
    getServerAuth().api.getSession({ headers }),
  now: Date = new Date(),
): Promise<VerifiedSession> {
  const sessionState = await readSession({ headers: request.headers });
  if (
    sessionState === null ||
    sessionState.session.expiresAt.getTime() <= now.getTime()
  ) {
    throw new PublicApiError("UNAUTHENTICATED", "Sign in is required.");
  }

  return {
    authUserId: sessionState.user.id,
    displayName: sessionState.user.name,
  };
}
