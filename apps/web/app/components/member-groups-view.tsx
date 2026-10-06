import { ArrowRight, Users, Store } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ViewerGroupSummary } from "../../src/features/groups/group-runtime";
import type { CompactOrderSummary } from "../../src/features/orders/orders-service";
import { formatHistoryDate } from "../../src/features/orders/order-format";

/** Rich membership cards use only the viewer's real groups and authorized history. */
export function MemberGroupsView({
  groups,
  history = [],
}: {
  readonly groups: readonly ViewerGroupSummary[];
  readonly history?: readonly CompactOrderSummary[];
}) {
  return (
    <section className="member-page groups-page groups-reference">
      <header className="page-intro">
        <h1>Your groups</h1>
        <p>Food brings people closer. Pick a group and start ordering!</p>
      </header>
      <ul className="group-list">
        {groups.map((group) => {
          const lastOrder = history.find(
            (order) =>
              order.groupId === group.groupId && order.state === "ordered",
          );
          const canStart =
            group.role === "group-owner" || group.role === "manager";
          const role =
            group.role === "group-owner"
              ? "Group Owner"
              : group.role === "manager"
                ? "Manager"
                : "Member";
          return (
            <li className="membership-card" key={group.groupId}>
              <Link
                className="membership-card__identity"
                href={`/groups/${group.groupId}`}
              >
                <span className="membership-card__cover" aria-hidden="true">
                  <Users size={32} />
                </span>
                <span>
                  <strong>{group.name}</strong>
                  <small>
                    {group.memberCount}{" "}
                    {group.memberCount === 1 ? "member" : "members"} · {role}
                  </small>
                  <span
                    className="membership-card__people"
                    aria-label="Group member preview"
                  >
                    {group.memberPreviews.map((member, index) => (
                      <span
                        className="member-avatar"
                        key={index}
                        title={member.displayName}
                      >
                        {member.displayName.charAt(0)}
                      </span>
                    ))}
                    {group.memberCount > group.memberPreviews.length ? (
                      <span className="avatar-overflow">
                        +{group.memberCount - group.memberPreviews.length}
                      </span>
                    ) : null}
                  </span>
                </span>
              </Link>
              <Link
                className="membership-card__start"
                href={
                  canStart
                    ? `/orders/new?groupId=${encodeURIComponent(group.groupId)}`
                    : `/groups/${group.groupId}`
                }
              >
                {canStart ? "Start group order" : "View group"}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link
                className="membership-card__recent"
                href={
                  lastOrder
                    ? `/orders/${lastOrder.orderId}`
                    : `/groups/${group.groupId}`
                }
              >
                <span className="membership-card__food" aria-hidden="true">
                  {lastOrder?.restaurantImageUrl ? (
                    <Image
                      src={lastOrder.restaurantImageUrl}
                      width={60}
                      height={60}
                      alt=""
                    />
                  ) : (
                    <Store size={24} />
                  )}
                </span>
                <span>
                  <small>{lastOrder ? "Last ordered" : "Group history"}</small>
                  <strong>
                    {lastOrder?.restaurantName ?? "See your group’s orders"}
                  </strong>
                  {lastOrder?.completedAt ? (
                    <small>{formatHistoryDate(lastOrder.completedAt)}</small>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
