import { getCurrentServerPageIdentity } from "../../../src/auth/load-server-page-identity";
import { MemberAccessState } from "../../components/member-access-state";
import { GroupsOverview } from "../../components/groups-overview";

/** Preserves the former Team URL while presenting the approved multi-group experience. */
export default async function TeamPage() {
  const identityResult = await getCurrentServerPageIdentity();
  const hasMemberships =
    identityResult.status === "authenticated" &&
    identityResult.identity.memberships.length > 0;
  const memberships =
    identityResult.status === "authenticated"
      ? identityResult.identity.memberships
      : [];

  return (
    <MemberAccessState hasMemberships={hasMemberships} surface="groups">
      <GroupsOverview memberships={memberships} />
    </MemberAccessState>
  );
}
