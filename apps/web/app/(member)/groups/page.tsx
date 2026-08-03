import { getCurrentServerPageIdentity } from "../../../src/auth/load-server-page-identity";
import { MemberAccessState } from "../../components/member-access-state";
import { GroupsOverview } from "../../components/groups-overview";

/** Exposes the approved multiple-groups destination at its final member URL. */
export default async function GroupsPage() {
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
