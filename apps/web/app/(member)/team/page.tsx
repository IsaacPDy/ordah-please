import { getCurrentServerPageIdentity } from "../../../src/auth/load-server-page-identity";
import { groupRuntime } from "../../../src/features/groups/group-runtime";
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
  const groupSummaries = hasMemberships
    ? await groupRuntime.listViewerGroupSummaries(
        memberships.map((membership) => ({
          groupId: membership.groupId,
          role: membership.role,
        })),
      )
    : [];

  return (
    <MemberAccessState hasMemberships={hasMemberships} surface="groups">
      <GroupsOverview groups={groupSummaries} />
    </MemberAccessState>
  );
}
