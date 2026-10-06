import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { DatabaseTransaction } from "../transaction.js";
import { users } from "../schema/index.js";

export class MemberLinkConflict extends Error {}

/** Merges an unlinked member into a signed-in product identity. Caller supplies a transaction.
 * Parent participant rows are copied before children move, preserving immediate foreign keys.
 * Historical names and audit actors remain unchanged. No login identity is reassigned.
 */
export async function linkPreAddedMember(
  database: DatabaseTransaction,
  memberUserId: string,
  accountUserId: string,
): Promise<void> {
  const rows = await database
    .select()
    .from(users)
    .where(inArray(users.id, [memberUserId, accountUserId]))
    .orderBy(users.id)
    .for("update");
  const member = rows.find((row) => row.id === memberUserId);
  const account = rows.find((row) => row.id === accountUserId);
  if (
    !member ||
    !account ||
    member.id === account.id ||
    member.archivedAt !== null ||
    account.archivedAt !== null ||
    member.authUserId !== null ||
    account.authUserId === null ||
    member.isPlatformAdmin
  ) {
    throw new MemberLinkConflict(
      "Choose an active member without a login and an active signed-in account.",
    );
  }
  const duplicateOrders = await database.execute(sql`
    SELECT 1 FROM order_participants m JOIN order_participants a ON a.order_id = m.order_id
    WHERE m.user_id = ${memberUserId}::uuid AND a.user_id = ${accountUserId}::uuid LIMIT 1`);
  if (duplicateOrders.rows.length > 0) {
    throw new MemberLinkConflict(
      "Both members appear in the same session. Resolve the duplicate participant before linking.",
    );
  }
  const duplicateFavorites = await database.execute(sql`
    SELECT 1 FROM favorites m JOIN favorites a ON a.branch_id = m.branch_id AND a.rank = m.rank
    WHERE m.user_id = ${memberUserId}::uuid AND a.user_id = ${accountUserId}::uuid LIMIT 1`);
  if (duplicateFavorites.rows.length > 0) {
    throw new MemberLinkConflict(
      "Both members have favorites at the same rank. Resolve the duplicate favorites before linking.",
    );
  }
  await database.execute(sql`
    WITH moved AS (DELETE FROM memberships WHERE user_id = ${memberUserId}::uuid RETURNING *)
    INSERT INTO memberships (group_id, user_id, role, joined_at, removed_at)
    SELECT group_id, ${accountUserId}::uuid, role, joined_at, removed_at FROM moved
    ON CONFLICT (group_id, user_id) DO UPDATE SET
      role = CASE
        WHEN memberships.removed_at IS NOT NULL THEN EXCLUDED.role
        WHEN EXCLUDED.removed_at IS NOT NULL THEN memberships.role
        WHEN memberships.role = 'owner' OR EXCLUDED.role = 'owner' THEN 'owner'::membership_role
        WHEN memberships.role = 'manager' OR EXCLUDED.role = 'manager' THEN 'manager'::membership_role
        ELSE 'member'::membership_role END,
      joined_at = LEAST(memberships.joined_at, EXCLUDED.joined_at),
      removed_at = CASE WHEN memberships.removed_at IS NULL OR EXCLUDED.removed_at IS NULL THEN NULL ELSE LEAST(memberships.removed_at, EXCLUDED.removed_at) END`);
  await database.execute(sql`
    INSERT INTO order_participants (order_id, user_id, display_name_snapshot, role, restaurant_response, food_response, selected_at)
    SELECT order_id, ${accountUserId}::uuid, display_name_snapshot, role, restaurant_response, food_response, selected_at
    FROM order_participants WHERE user_id = ${memberUserId}::uuid`);
  for (const table of ["restaurant_votes", "food_selections", "order_lines"]) {
    await database.execute(
      sql`UPDATE ${sql.identifier(table)} SET user_id = ${accountUserId}::uuid WHERE user_id = ${memberUserId}::uuid`,
    );
  }
  await database.execute(
    sql`DELETE FROM order_participants WHERE user_id = ${memberUserId}::uuid`,
  );
  // Explicit schema-owned references; never interpolate request-supplied identifiers.
  for (const [table, column] of [
    ["favorites", "user_id"],
    ["orders", "manager_user_id"],
    ["groups", "created_by_user_id"],
    ["invitations", "created_by_user_id"],
    ["invitations", "accepted_by_user_id"],
    ["group_addresses", "updated_by_user_id"],
    ["group_invite_links", "created_by_user_id"],
    ["file_records", "owner_user_id"],
    ["catalog_imports", "created_by_user_id"],
    ["refresh_runs", "created_by_user_id"],
    ["refresh_review_outcomes", "decided_by_user_id"],
    ["notifications", "recipient_user_id"],
    ["food_selections", "resolved_by_user_id"],
    ["receipts", "uploaded_by_user_id"],
    ["admin_access_requests", "requester_user_id"],
    ["admin_access_requests", "decided_by_user_id"],
  ] as const) {
    await database.execute(
      sql`UPDATE ${sql.identifier(table)} SET ${sql.identifier(column)} = ${accountUserId}::uuid WHERE ${sql.identifier(column)} = ${memberUserId}::uuid`,
    );
  }
  await database
    .update(users)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(users.id, memberUserId), isNull(users.archivedAt)));
}
