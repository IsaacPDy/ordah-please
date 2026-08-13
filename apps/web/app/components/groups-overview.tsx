import Link from "next/link";

export interface GroupSummaryForDisplay {
  readonly groupId: string;
  readonly name: string;
  readonly role: string;
  readonly memberCount: number;
}

export interface GroupsOverviewProps {
  readonly groups: readonly GroupSummaryForDisplay[];
}

/** Converts the stored role key into the exact role wording shown to people. */
function roleLabel(role: string) {
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

/** Shows the signed-in account's real group memberships and roles. */
export function GroupsOverview({ groups }: GroupsOverviewProps) {
  return (
    <div className="member-page">
      <header className="page-intro">
        <p className="eyebrow">Memberships</p>
        <h1>Your groups</h1>
        <p>
          You can belong to multiple groups and hold a different role in each.
        </p>
      </header>
      <ul className="group-list">
        {groups.map((group) => (
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
                </span>
              </span>
              <span
                className={
                  group.role === "group-owner"
                    ? "role-pill role-pill--owner"
                    : group.role === "member"
                      ? "role-pill role-pill--member"
                      : "role-pill"
                }
              >
                {roleLabel(group.role)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
