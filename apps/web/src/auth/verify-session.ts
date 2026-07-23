import { auth } from "@clerk/nextjs/server";
import { PublicApiError } from "@ordah-please/contracts";

export interface ClerkSessionState {
  readonly isAuthenticated: boolean;
  readonly userId: string | null;
}

export type ReadClerkSession = () => Promise<ClerkSessionState>;

export interface VerifiedSession {
  readonly clerkUserId: string;
}

/** Reads the Clerk request context so API code can verify the active server-side session. */
async function readClerkSession(): Promise<ClerkSessionState> {
  const { isAuthenticated, userId } = await auth();
  return { isAuthenticated, userId };
}

/** Rejects requests that do not carry a verified Clerk user session. */
export async function verifySession(
  readSession: ReadClerkSession = readClerkSession,
): Promise<VerifiedSession> {
  const session = await readSession();
  if (!session.isAuthenticated || session.userId === null) {
    throw new PublicApiError("UNAUTHENTICATED", "Sign in is required.");
  }

  return { clerkUserId: session.userId };
}
