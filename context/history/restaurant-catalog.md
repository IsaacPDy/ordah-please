# Restaurant catalog

Subtasks:

- Strict CSV parsing and response contracts for restaurant imports
- Catalog schema additions for restaurant cuisines and menu-item image URLs
- Transactional catalog import with replace semantics and editable restaurant/menu fields
- Authenticated catalog list/detail APIs and Platform Admin import/edit APIs
- Admin upload, catalog, and restaurant-edit screens
- Real restaurant Home and detail screens on web and mobile
- Honest Favorites empty states and removal of stale restaurant mocks

## Completion evidence

- Development Neon migration `0005_illegal_sally_floyd.sql` was applied and both added columns were verified.
- Authenticated web acceptance uploaded McDonald's (158 menu items) and KFC (129 menu items), displayed both restaurants on the admin Catalog and member Home, loaded the full McDonald's detail, and verified a reversible cuisine edit persisted after reload.
- `npm test` passed 70 Vitest files with 372 tests and 17 mobile Jest suites with 57 tests after the pre-merge repairs.
- `npm run typecheck` passed for every workspace.
- `npm run lint` passed with one pre-existing mobile Hooks warning and no errors.
- `npm run build:web` completed the Next.js production build.
- `npm run db:check --workspace @ordah-please/db` validated the generated migrations and snapshots.
- `git diff --check main...task/restaurant-catalog-import` passed.
- Pre-merge review added strict handler-to-client contract tests, invalid/empty upload rejection, content-type checks, source-ID replacement coverage, one import record per upload, stored upload filenames, unknown-edit 404 behavior, branch editing, Catalog search, and the Recent imports table.
- Isolated development-Neon repository verification passed 12 provider tests, including renamed source-ID replacement and recent-import counts.

## Known verification boundary

- Android runtime acceptance is blocked on the installed Android 16 emulator by a native Expo Router/Worklets crash. The same crash was reproduced in a fresh official Expo Router SDK 57 control project, while a plain Expo SDK 57 control project stayed open. This is recorded as a tooling/device verification blocker, not as a successful mobile acceptance result.
- Development Neon was preflighted with no duplicate source IDs, then `0006` and `0007` were applied together and their constraint/column were verified. The pre-existing Drizzle journal recorded only through `0003` even though the exact schema effects of `0004`–`0007` were present. After verifying each effect, the four missing journal rows were backfilled transactionally using the migration files' SHA-256 hashes and recorded timestamps. A normal `drizzle-kit migrate` run then completed successfully without replay errors.
- Production Neon was not migrated or populated during this task. Development Neon is the accepted catalog target.

## Deferred scope

- Restaurant archive/delete actions, adding or deleting individual menu items, Favorites persistence/ranking, modifiers, search filters, pagination, and catalog refresh automation remain separate work.
