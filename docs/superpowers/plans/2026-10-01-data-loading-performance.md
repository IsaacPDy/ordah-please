# Faster page data loading implementation plan

**Goal:** Reduce the actual private-data wait after member navigation.

**Architecture:** Keep Server Components and resource authorization. Remove redundant connection setup and serialized queries while colocating the Vercel runtime with the confirmed Singapore database.

**Tech stack:** Next.js 16.2, Better Auth 1.6, Drizzle 0.45, pg, Neon, Vercel Hobby.

Execute inline and solo as required by AGENTS.md. The user has authorized applying the previously presented fixes.

## 1. Shared runtime connection

- [x] Add a regression test in `packages/db/src/client.test.ts` proving two runtime consumers receive the same database instance without connecting at import time.
- [x] Run `npx vitest run --project server packages/db/src/client.test.ts`; verify the new assertion fails.
- [x] Export `getRuntimeDatabase(): Database` from `packages/db/src/client.ts`, backed by one module-local lazy DatabaseClient. Retain `createDatabaseClient` for explicitly isolated clients.
- [x] Replace per-feature pool creation in access, catalog, favorites, groups, orders, users, and `apps/web/src/auth/server-auth.ts` with the shared getter. Preserve transaction runners.
- [x] Re-run the focused test and commit the slice.

## 2. Read identity without steady-state writes

- [x] Add tests in `apps/web/src/auth/load-app-identity.test.ts` for existing users, fresh permissions on a later request, provisioning, changed names, and archived users.
- [x] Add `findIdentityByAuthUserId(authUserId): Promise<ProductIdentityRow | undefined>` to `packages/db/src/repositories/identity-access.ts`. ProductIdentityRow contains `user` and `memberships` (groupId and role).
- [x] Read users with a left join to active memberships; retain groupless and archived users in the result. `loadAppIdentity` uses this result, synchronizing through the existing atomic upsert only for missing users or changed names, then re-reading permissions.
- [x] Add provider assertions proving removed memberships are excluded and repeated loads leave updatedAt unchanged. Run the focused tests and commit.

## 3. Joined sessions and favorites

- [x] Add a real Better Auth adapter test in `server-auth.test.ts` using a fake pg transport and verify session/user resolution requires one SQL query. Run it before enabling joins.
- [x] Add Drizzle auth relations in `packages/db/src/schema/authentication.ts` and enable `experimental: { joins: true }` in Better Auth options. No migration is needed because relations are ORM metadata.
- [x] Add query-count assertions to the existing favorite provider tests and verify they fail before changing the reads.
- [x] Replace per-favorite item queries with one left join and group the rows. Replace the two favorite-card reads with one joined query using a deterministic single-item subquery so each favorite still yields one card.
- [x] Verify the full returned data, empty cases, ownership filters, and real adapter session expiry/revocation. Commit the slice.

## 4. Region, verification, and release

- [x] Create `apps/web/vercel.json` with `{"regions":["sin1"]}`; the project root is apps/web and the user confirms production Neon is in Singapore.
- [x] Update architecture, structure, service setup, and progress context to describe the new connection and read contracts.
- [x] Run `npm run test:unit`, isolated development provider tests, `npm run typecheck`, `npm run lint`, `npm run build:web`, and `git diff --check`.
- [x] Record evidence in `context/history/v1-09.md`. Review the full diff against the spec and security boundaries.
- [x] Follow the repository squash/push workflow with the exact task title `V1-09 Faster page data loading`; verify the resulting Vercel deployment and signed-in data-readiness timings before marking hosted acceptance complete.
