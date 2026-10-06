import { MemberGroupsView } from "../../components/member-groups-view";
import { ordersRuntime } from "../../../src/features/orders/orders-runtime";

import { getCurrentServerPageIdentity } from "../../../src/auth/load-server-page-identity";
import { groupRuntime } from "../../../src/features/groups/group-runtime";
import { MemberAccessState } from "../../components/member-access-state";

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
  const [groupSummaries, history] = await Promise.all([
    hasMemberships
      ? groupRuntime.listViewerGroupSummaries(memberships)
      : Promise.resolve([]),
    identityResult.status === "authenticated" && hasMemberships
      ? ordersRuntime
          .listOrderSummaryPage({
            identity: identityResult.identity,
            cursor: null,
            limit: 10,
          })
          .then((page) => page.history)
          .catch(() => [])
      : Promise.resolve([]),
  ]);
  return (
    <MemberAccessState hasMemberships={hasMemberships} surface="groups">
      <MemberGroupsView groups={groupSummaries} history={history} />
    </MemberAccessState>
  );
}
