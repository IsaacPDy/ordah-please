import "./session-log-editor.css";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createRepositories,
  getRuntimeDatabase,
  type SessionLogWrite,
} from "@ordah-please/db";
import { getCurrentServerPageIdentity } from "../../../../../src/auth/load-server-page-identity";
import { SessionLogEditor } from "./session-log-editor";
export default async function EditSessionPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const result = await getCurrentServerPageIdentity();
  if (result.status !== "authenticated") notFound();
  const repositories = createRepositories(getRuntimeDatabase());
  const row = await repositories.orders.findOrderDetail(orderId);
  if (
    !row ||
    !result.identity.memberships.some(
      (member) =>
        member.groupId === row.groupId &&
        ["group-owner", "manager"].includes(member.role),
    )
  )
    notFound();
  const [members, restaurants, lines] = await Promise.all([
    repositories.groupAccess.listActiveMembers(row.groupId),
    repositories.catalog.listRestaurants(),
    repositories.orders.listOrderLines(orderId),
  ]);
  const initial: SessionLogWrite = {
    groupId: row.groupId,
    state:
      row.state === "ordered" || row.state === "cancelled"
        ? row.state
        : "draft",
    restaurantId: row.selectedRestaurantId ?? row.initialRestaurantId,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    managerUserId: row.managerUserId,
    deliveryAddress: Object.keys(row.deliveryAddressSnapshot as object).length
      ? (row.deliveryAddressSnapshot as Record<string, unknown>)
      : null,
    participants: row.participants.map((person) => ({
      userId: person.userId,
      displayName: person.displayName,
      foodResponse: person.foodResponse,
      lines: lines
        .filter((line) => line.userId === person.userId)
        .map((line) => ({
          ...(line.id ? { originalLineId: line.id } : {}),
          itemName: line.itemNameSnapshot,
          quantity: line.quantity,
          unitPriceCentavos: line.unitPriceCentavos,
          note: line.noteSnapshot,
          lineSubtotalCentavos: line.lineSubtotalCentavos,
        })),
    })),
  };
  return (
    <div className="member-page">
      <Link href={`/orders/${orderId}`} className="back-link">
        Back to session
      </Link>
      <header className="page-intro">
        <h1>Edit session</h1>
        <p>{row.groupName} · Changes update the saved history for everyone.</p>
        {row.state !== "draft" &&
        row.state !== "ordered" &&
        row.state !== "cancelled" ? (
          <p role="note">
            Saving these edits replaces the current voting and food-selection
            workflow with a manually managed session in History.
          </p>
        ) : null}
      </header>
      <SessionLogEditor
        orderId={orderId}
        initial={initial}
        members={members}
        restaurants={restaurants}
      />
    </div>
  );
}
