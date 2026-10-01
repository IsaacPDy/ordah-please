# V1-09 Faster page data loading

**Status:** Implementation authorized by the user on 2026-10-01.

## Problem and evidence

Navigation shells respond quickly but private data arrives later. Signed-in production browser-controller samples on 2026-10-01 were Favorites 5,643/5,848 ms, Orders 5,711/2,810 ms, Groups 2,823/2,846 ms, and Home 3,175 ms. These are wall-clock readiness observations, not Web Vitals or isolated SQL timings. Vercel settings and a live API response identify the function region as `iad1`. The user confirms the production Neon database is in Singapore, matching the local `ap-southeast-1` database configuration.

## Approved implementation

- Set the web project's Vercel function region to `sin1`.
- Reuse one lazy database pool within each server instance across auth and feature runtimes. Do not cache private query results.
- Read product user and active memberships in one query. Ordinary requests must not write an unchanged profile. Provision missing users safely under concurrent requests; synchronize changed names only; reject archived users before syncing.
- Enable Better Auth 1.6 database joins with explicit Drizzle relations so the live session and auth user load in one query. Keep expiry, revocation, and current product authorization checks; do not enable cookie session caching.
- Read favorite cards and representative items together. Read all items for branch favorites in one query, preserving empty favorites, ordering, quantities, and notes.
- Preserve route behavior, role boundaries, catalog invalidation, and English product language. No schema migration, paid upgrade, or UI redesign is required.

## Verification and acceptance

Write regression tests before implementation. Cover no-write identity loading, groupless and removed memberships, archived users, changed-name sync, concurrent provisioning, pool reuse, session query counts, and favorite query counts/data. Run provider reads against a disposable temporary development schema, then unit tests, typecheck, lint, and production build. Verify real signed-in page behavior and comparable data-readiness timings after publication. Record local checks separately from hosted acceptance.
