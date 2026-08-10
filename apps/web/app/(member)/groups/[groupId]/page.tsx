import { notFound } from "next/navigation";
import { parseId, type GroupId } from "@ordah-please/domain";

import { getCurrentServerPageIdentity } from "../../../../src/auth/load-server-page-identity";
import { requireGroupMembership } from "../../../../src/application/group-authorization";
import { groupRuntime } from "../../../../src/features/groups/group-runtime";
import { GroupDetailsView } from "../../../components/group-details-view";

/** Renders one group's details for any of its members; management actions appear for owners only. */
export default async function GroupDetailsPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const identityResult = await getCurrentServerPageIdentity();
  if (identityResult.status !== "authenticated") {
    notFound();
  }

  const membership = requireGroupMembership(
    identityResult.identity,
    parseId<GroupId>(groupId),
  );

  const details = await groupRuntime.loadGroupDetails({
    groupId: membership.groupId,
    viewerRole: membership.role,
  });

  return (
    <GroupDetailsView
      details={details}
      canManage={membership.role === "group-owner"}
    />
  );
}
