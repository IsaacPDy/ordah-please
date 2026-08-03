import { ChevronRight, Clock3, Crown, ShieldCheck, Users } from "lucide-react";

const groups = [
  {
    activeOrders: 1,
    members: 7,
    name: "Friends",
    nextDeadline: "Today, 11:30 AM",
    role: "Member",
  },
  {
    activeOrders: 1,
    members: 12,
    name: "Design team",
    nextDeadline: "Tomorrow, 5:00 PM",
    role: "Manager",
  },
] as const;

/** Shows every group the signed-in user belongs to and a role-aware member preview. */
export function GroupsOverview() {
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
        {groups.map((group) => (
          <article className="group-card" key={group.name}>
            <div className="group-card__icon">
              <Users aria-hidden="true" />
            </div>
            <div className="group-card__body">
              <div>
                <h2>{group.name}</h2>
                <span className="role-pill">{group.role}</span>
              </div>
              <p>
                <Users aria-hidden="true" size={16} /> {group.members} members ·{" "}
                {group.activeOrders} active order
              </p>
              <p>
                <Clock3 aria-hidden="true" size={16} /> Next deadline{" "}
                {group.nextDeadline}
              </p>
            </div>
            <ChevronRight aria-hidden="true" />
          </article>
        ))}
      </div>
      <section
        aria-labelledby="members-heading"
        className="content-section group-detail-card"
      >
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Friends</p>
            <h2 id="members-heading">Members</h2>
          </div>
          <button className="secondary-action" type="button">
            View group
          </button>
        </div>
        <ul className="member-list">
          <li>
            <span className="member-avatar">MP</span>
            <div>
              <strong>Mia Perez</strong>
              <p>mia@example.com · 8 orders</p>
            </div>
            <span className="role-pill role-pill--owner">
              <Crown aria-hidden="true" size={14} /> Group Owner
            </span>
          </li>
          <li>
            <span className="member-avatar member-avatar--alt">JD</span>
            <div>
              <strong>Jordan Diaz</strong>
              <p>jordan@example.com · 6 orders</p>
            </div>
            <span className="role-pill">
              <ShieldCheck aria-hidden="true" size={14} /> Manager
            </span>
          </li>
          <li>
            <span className="member-avatar member-avatar--soft">AK</span>
            <div>
              <strong>Alex Kim</strong>
              <p>alex@example.com · 4 orders</p>
            </div>
            <span className="role-pill role-pill--member">Member</span>
          </li>
        </ul>
      </section>
    </div>
  );
}
