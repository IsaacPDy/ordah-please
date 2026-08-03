import { headers as nextHeaders } from "next/headers";

import { PublicApiError } from "@ordah-please/contracts";

import { verifySession } from "../../../src/auth/verify-session";
import { accessRuntime } from "../../../src/features/access/access-runtime";
import { AdminDecisionPanel } from "../../../src/features/access/admin-decision-panel";
import { SignInPrompt } from "../../../src/features/access/sign-in-prompt";

const SIGN_IN_CALLBACK = "/admin/access-requests";

/** Loads the signed-in product identity, or null when no live session exists. */
async function loadIdentityOrNull() {
  const headerList = await nextHeaders();
  const requestHeaders = new Headers();
  headerList.forEach((value, key) => {
    requestHeaders.set(key, value);
  });
  const request = new Request(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    { headers: requestHeaders },
  );
  try {
    const session = await verifySession(request);
    return await accessRuntime.loadIdentity(session);
  } catch (error) {
    if (error instanceof PublicApiError && error.code === "UNAUTHENTICATED") {
      return null;
    }
    throw error;
  }
}

/** Platform-admin screen for approving or rejecting pending platform-admin requests. */
export default async function AccessRequestsPage() {
  const identity = await loadIdentityOrNull();
  if (identity === null) {
    return <SignInPrompt callbackURL={SIGN_IN_CALLBACK} />;
  }
  if (!identity.roles.includes("platform-admin")) {
    return <p>Only platform admins can review access requests.</p>;
  }
  return <AdminDecisionPanel />;
}
