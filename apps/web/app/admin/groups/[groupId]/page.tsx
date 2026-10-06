import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicApiError } from "@ordah-please/contracts";
import { getCurrentServerPageIdentity } from "../../../../src/auth/load-server-page-identity";
import { groupRuntime } from "../../../../src/features/groups/group-runtime";
import { usersRuntime } from "../../../../src/features/users/users-runtime";
import { AdminPage } from "../../../components/admin-page";
import { GroupMembersView } from "../group-members-view";

/** Checks admin identity before reading this group's private roster or available people. */
export default async function AdminGroupMembersPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const identity = await getCurrentServerPageIdentity();
  if (identity.status !== "authenticated" || !identity.identity.isPlatformAdmin)
    notFound();
  const { groupId } = await params;
  let group;
  try {
    group = await groupRuntime.loadGroupMembersAsAdmin({
      actorUserId: identity.identity.userId,
      groupId,
    });
  } catch (error) {
    if (error instanceof PublicApiError && error.code === "NOT_FOUND")
      notFound();
    throw error;
  }
  const users = group.archivedAt ? [] : await usersRuntime.listUsersForAdmin();
  return (
    <AdminPage
      eyebrow="Membership"
      title={group.name}
      description="Add people and appoint managers for this group."
      actions={
        <Link className="secondary-action" href="/admin/groups">
          Back to Groups
        </Link>
      }
    >
      <GroupMembersView
        group={group}
        users={users.map(({ id, displayName }) => ({ id, displayName }))}
      />
    </AdminPage>
  );
}
