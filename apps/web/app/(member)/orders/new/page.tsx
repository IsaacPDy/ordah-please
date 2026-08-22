import Link from "next/link";
import type { ReactNode } from "react";

import {
  createRepositories,
  createDatabaseClient,
  type Database,
} from "@ordah-please/db";

import { getCurrentServerPageIdentity } from "../../../../src/auth/load-server-page-identity";
import { MemberAccessState } from "../../../components/member-access-state";
import { NewOrderWizard } from "./new-order-wizard";

let runtimeDatabase: Database | undefined;

function getRuntimeDatabase(): Database {
  runtimeDatabase ??= createDatabaseClient().database;
  return runtimeDatabase;
}

/** Order setup: pick a group, then walk the manager through starting an order. */
export default async function NewOrderPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly groupId?: string }>;
}) {
  const { groupId } = await searchParams;
  const identityResult = await getCurrentServerPageIdentity();
  const hasMemberships =
    identityResult.status === "authenticated" &&
    identityResult.identity.memberships.length > 0;

  const eligible =
    identityResult.status === "authenticated"
      ? identityResult.identity.memberships.filter(
          (membership) =>
            membership.role === "group-owner" || membership.role === "manager",
        )
      : [];
  const managerUserId =
    identityResult.status === "authenticated"
      ? identityResult.identity.userId
      : "";

  let wizard: ReactNode = null;
  if (groupId !== undefined && eligible.some((m) => m.groupId === groupId)) {
    const repositories = createRepositories(getRuntimeDatabase());
    const [members, address, restaurants] = await Promise.all([
      repositories.groupAccess.listActiveMembers(groupId),
      repositories.groupAccess.findGroupAddress(groupId),
      repositories.catalog.listRestaurants(),
    ]);
    const group = await repositories.groupAccess.findGroupSummary(groupId);
    wizard = (
      <NewOrderWizard
        groupAddress={
          address === undefined
            ? null
            : {
                city: address.city,
                lineOne: address.lineOne,
                lineTwo: address.lineTwo,
                notes: address.notes,
                phoneNumber: address.phoneNumber,
                postalCode: address.postalCode,
                recipientName: address.recipientName,
              }
        }
        groupId={groupId}
        groupName={group?.name ?? "Group"}
        managerUserId={managerUserId}
        members={members}
        restaurants={restaurants}
      />
    );
  }

  return (
    <MemberAccessState hasMemberships={hasMemberships} surface="orders">
      <div className="member-page">
        <header className="page-intro">
          <p className="eyebrow">Order setup</p>
          <h1>New group order</h1>
          <p>Four quick steps. You can review everything before sending.</p>
        </header>
        <div aria-label="Order setup progress" className="setup-progress">
          <span className="setup-progress__active" />
          <span />
          <span />
          <span />
        </div>

        {eligible.length === 0 ? (
          <p className="restaurant-empty">
            Only a group Owner or Manager can start orders. Ask your
            group&apos;s owner if an order should be started.
          </p>
        ) : groupId === undefined ? (
          <ul className="group-list">
            {eligible.map((membership) => (
              <GroupChoice
                key={membership.groupId}
                groupId={membership.groupId}
              />
            ))}
          </ul>
        ) : wizard === null ? (
          <p className="restaurant-empty">
            You can start orders only for groups you own or manage.{" "}
            <Link href="/orders/new">Pick another group.</Link>
          </p>
        ) : (
          wizard
        )}
      </div>
    </MemberAccessState>
  );
}

async function GroupChoice({ groupId }: { readonly groupId: string }) {
  const repositories = createRepositories(getRuntimeDatabase());
  const [summary, members] = await Promise.all([
    repositories.groupAccess.findGroupSummary(groupId),
    repositories.groupAccess.listActiveMembers(groupId),
  ]);
  return (
    <li>
      <Link
        className="group-card group-card--link"
        href={`/orders/new?groupId=${encodeURIComponent(groupId)}`}
      >
        <span aria-hidden="true" className="group-card__icon">
          {(summary?.name ?? "G").charAt(0)}
        </span>
        <span className="group-card__body">
          <span className="group-card__name">{summary?.name ?? "Group"}</span>
          <span className="group-card__meta">
            {members.length} {members.length === 1 ? "person" : "people"}
          </span>
        </span>
      </Link>
    </li>
  );
}
