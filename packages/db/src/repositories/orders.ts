import { eq } from "drizzle-orm";

import { orders } from "../schema/index.js";
import type { RepositoryDatabase } from "./database.js";
import { requireWrittenRow } from "./rows.js";

export interface PersistedOrderState {
  readonly completedAt: Date | null;
  readonly state: typeof orders.$inferSelect.state;
  readonly updatedAt: Date;
}

export interface OrdersRepository {
  findById(id: string): Promise<typeof orders.$inferSelect | undefined>;
  setState(
    id: string,
    next: PersistedOrderState,
  ): Promise<typeof orders.$inferSelect>;
}

/** Creates order persistence operations that apply already-authorized domain outcomes. */
export function createOrdersRepository(
  database: RepositoryDatabase,
): OrdersRepository {
  return {
    findById: async (id) => {
      const [order] = await database
        .select()
        .from(orders)
        .where(eq(orders.id, id))
        .limit(1);
      return order;
    },
    setState: async (id, next) =>
      requireWrittenRow(
        await database
          .update(orders)
          .set(next)
          .where(eq(orders.id, id))
          .returning(),
      ),
  };
}
