import { getCurrentServerPageIdentity } from "../../../src/auth/load-server-page-identity";
import { ordersRuntime } from "../../../src/features/orders/orders-runtime";
import type { OrderSummaryPage } from "../../../src/features/orders/orders-service";
import { MemberAccessState } from "../../components/member-access-state";
import { SessionsView } from "./sessions-view";

/** Shows actionable current orders and immutable past participation. */
export default async function OrdersPage({
  searchParams,
}: { readonly searchParams?: Promise<{ tab?: string }> } = {}) {
  const initialTab = (await searchParams)?.tab === "past" ? "past" : "active";
  const identityResult = await getCurrentServerPageIdentity();
  const hasMemberships =
    identityResult.status === "authenticated" &&
    identityResult.identity.memberships.length > 0;
  const canStartOrder =
    identityResult.status === "authenticated" &&
    identityResult.identity.memberships.some(
      (membership) =>
        membership.role === "group-owner" || membership.role === "manager",
    );

  let ordersLoadFailed = false;
  let summaries: OrderSummaryPage = {
    active: [],
    history: [],
    nextCursor: null,
  };
  if (identityResult.status === "authenticated") {
    try {
      summaries = await ordersRuntime.listOrderSummaryPage({
        cursor: null,
        identity: identityResult.identity,
        limit: 10,
      });
    } catch {
      ordersLoadFailed = true;
    }
  }

  return (
    <MemberAccessState hasMemberships={hasMemberships} surface="orders">
      {ordersLoadFailed ? (
        <p className="restaurant-empty" role="status">
          Couldn't load orders. Refresh this page to try again.
        </p>
      ) : null}
      <SessionsView
        summaries={summaries}
        canStartOrder={canStartOrder}
        initialTab={initialTab}
      />
    </MemberAccessState>
  );
}
