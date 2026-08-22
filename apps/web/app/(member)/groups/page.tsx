import { ChevronRight } from "lucide-react";
import Link from "next/link";

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
  const groupSummaries = hasMemberships
    ? await groupRuntime.listViewerGroupSummaries(memberships)
    : [];

  return (
    <MemberAccessState hasMemberships={hasMemberships} surface="groups">
      <section className="member-page">
        <header className="page-intro">
          <p className="eyebrow">Memberships</p>
          <h1>Your groups</h1>
          <p>Order with different circles without mixing their details.</p>
        </header>
        <ul className="group-list">
          {groupSummaries.map((group) => (
            <li key={group.groupId}>
              <Link
                className="group-card group-card--link"
                href={`/groups/${group.groupId}`}
              >
                <span className="group-card__icon" aria-hidden="true">
                  {initialsOf(group.name)}
                </span>
                <span className="group-card__body">
                  <span className="group-card__name">{group.name}</span>
                  <span className="group-card__meta">
                    {group.memberCount}{" "}
                    {group.memberCount === 1 ? "person" : "people"}
                    {` · You’re a ${roleLabel(group.role)}`}
                  </span>
                </span>
                <ChevronRight aria-hidden="true" size={24} />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </MemberAccessState>
  );
}

/** Converts the stored role key into the exact role wording shown to people. */
function roleLabel(role: string): string {
  if (role === "group-owner") {
    return "Group Owner";
  }
  if (role === "manager") {
    return "Manager";
  }
  return "Member";
}

/** Returns up to two uppercase initials from a group name for the icon badge. */
function initialsOf(name: string): string {
  const cleaned = name.trim();
  if (cleaned.length === 0) {
    return "G";
  }
  const parts = cleaned.split(/\s+/).filter((part) => part.length > 0);
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}
