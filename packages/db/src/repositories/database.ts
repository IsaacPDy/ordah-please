import type { DatabaseTransaction } from "../transaction.js";

export type RepositoryDatabase = Pick<
  DatabaseTransaction,
  "insert" | "select" | "update"
>;
