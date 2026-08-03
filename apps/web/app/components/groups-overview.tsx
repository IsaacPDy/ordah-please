import type { AppIdentitySummary } from "@ordah-please/contracts";
import { Crown, ShieldCheck, Users } from "lucide-react";

export interface GroupsOverviewProps {
  readonly memberships: AppIdentitySummary["memberships"];
}

/** Converts the stored role key into the exact role wording shown to people. */
function roleLabel(role: AppIdentitySummary["memberships"][number]["role"]) {
  if (role === "group-owner") {
    return "Group Owner";
  }

  if (role === "manager") {
    return "Manager";
  }

  return "Member";
}

/** Shows only the signed-in account's real group memberships and roles. */
export function GroupsOverview({ memberships }: GroupsOverviewProps) {
  return (
    <div className="member-page">
      <header className="page-intro">
        <p className="eyebrow">Memberships</p>
        <h1>Your groups</h1>
        <p>
          You can belong to multiple groups and hold a different role in each.
        </p>
      </header>
      <div className="group-list">
        {memberships.map((membership) => (
          <article className="group-card" key={membership.groupId}>
            <div className="group-card__icon">
              <Users aria-hidden="true" />
            </div>
            <div className="group-card__body">
              <div>
                <h2>{membership.groupId}</h2>
                <span
                  className={
                    membership.role === "group-owner"
                      ? "role-pill role-pill--owner"
                      : membership.role === "member"
                        ? "role-pill role-pill--member"
                        : "role-pill"
                  }
                >
                  {membership.role === "group-owner" ? (
                    <Crown aria-hidden="true" size={14} />
                  ) : membership.role === "manager" ? (
                    <ShieldCheck aria-hidden="true" size={14} />
                  ) : null}
                  {roleLabel(membership.role)}
                </span>
              </div>
              <p>
                Group details will appear after the membership journey is
                connected.
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
