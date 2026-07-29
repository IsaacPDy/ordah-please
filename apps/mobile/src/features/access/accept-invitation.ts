import { buildAuthenticatedRequestInit } from "../../auth/authenticated-request";

type InvitationAcceptance = Readonly<{
  groupId: string;
  role: "member";
}>;

type AcceptInvitationInput = Readonly<{
  apiBaseUrl: string;
  publicToken: string;
  sessionCookie: string;
}>;

type RequestFunction = (input: string, init: RequestInit) => Promise<Response>;

/** Narrows the trusted API's success envelope before native UI uses membership data. */
function parseAcceptance(value: unknown): InvitationAcceptance {
  if (
    typeof value !== "object" ||
    value === null ||
    !("ok" in value) ||
    value.ok !== true ||
    !("data" in value) ||
    typeof value.data !== "object" ||
    value.data === null ||
    !("groupId" in value.data) ||
    typeof value.data.groupId !== "string" ||
    !("role" in value.data) ||
    value.data.role !== "member"
  ) {
    throw new Error("This invitation could not be accepted.");
  }
  return { groupId: value.data.groupId, role: value.data.role };
}

/** Accepts one invitation with the Better Auth cookie managed by the native SecureStore bridge. */
export async function acceptInvitation(
  input: AcceptInvitationInput,
  request: RequestFunction = fetch,
): Promise<InvitationAcceptance> {
  const response = await request(
    `${input.apiBaseUrl.replace(/\/$/u, "")}/api/access/invitations/accept`,
    buildAuthenticatedRequestInit(input.sessionCookie, {
      body: JSON.stringify({ token: input.publicToken }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }),
  );
  if (!response.ok) {
    throw new Error("This invitation could not be accepted.");
  }
  return parseAcceptance(await response.json());
}
