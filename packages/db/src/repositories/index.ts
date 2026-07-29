import type { Database } from "../client.js";
import type { DatabaseTransaction } from "../transaction.js";
import {
  createAuditEventsRepository,
  type AuditEventsRepository,
} from "./audit-events.js";
import { createCatalogRepository, type CatalogRepository } from "./catalog.js";
import {
  createFavoritesRepository,
  type FavoritesRepository,
} from "./favorites.js";
import { createFilesRepository, type FilesRepository } from "./files.js";
import {
  createGroupAccessRepository,
  type GroupAccessRepository,
} from "./group-access.js";
import {
  createIdentityAccessRepository,
  type IdentityAccessRepository,
} from "./identity-access.js";
import { createJobsRepository, type JobsRepository } from "./jobs.js";
import {
  createNotificationsRepository,
  type NotificationsRepository,
} from "./notifications.js";
import { createOrdersRepository, type OrdersRepository } from "./orders.js";

export interface Repositories {
  readonly auditEvents: AuditEventsRepository;
  readonly catalog: CatalogRepository;
  readonly favorites: FavoritesRepository;
  readonly files: FilesRepository;
  readonly groupAccess: GroupAccessRepository;
  readonly identityAccess: IdentityAccessRepository;
  readonly jobs: JobsRepository;
  readonly notifications: NotificationsRepository;
  readonly orders: OrdersRepository;
}

/** Composes all focused repositories over either the pooled database or one transaction. */
export function createRepositories(
  database: Database | DatabaseTransaction,
): Repositories {
  return {
    auditEvents: createAuditEventsRepository(database),
    catalog: createCatalogRepository(database),
    favorites: createFavoritesRepository(database),
    files: createFilesRepository(database),
    groupAccess: createGroupAccessRepository(database),
    identityAccess: createIdentityAccessRepository(database),
    jobs: createJobsRepository(database),
    notifications: createNotificationsRepository(database),
    orders: createOrdersRepository(database),
  };
}

export * from "./audit-events.js";
export * from "./catalog.js";
export * from "./favorites.js";
export * from "./files.js";
export * from "./group-access.js";
export * from "./identity-access.js";
export * from "./jobs.js";
export * from "./notifications.js";
export * from "./orders.js";
