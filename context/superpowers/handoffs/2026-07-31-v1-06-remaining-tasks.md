# V1-06 Remaining-Tasks Handoff

Handoff doc for agents picking up V1-06 work mid-flight. Each task brief below is self-contained: an agent starting fresh on that task should not need to read the entire 2,284-line plan, only the section referenced plus the relevant source files.

## Current state

- **Task branch:** `task/V1-06-platform-admin-approval`
- **Squash target (do not push to main yet):** final commit must be titled exactly `V1-06 Implement platform-admin approval and limited mobile-admin permissions`

### Completed commits on the task branch

| SHA       | Title                                                                       |
| --------- | --------------------------------------------------------------------------- |
| `9c279b5` | docs: add V1-06 design and implementation plan                              |
| `5a2bf27` | feat(contracts): add V1-06 admin-access decide and pending-list contracts   |
| `3255a17` | chore: housekeeping before V1-06 work                                       |
| `a1c7d76` | feat(db): add V1-06 admin-access decide, list-pending, promote repositories |
| `c1608e8` | feat(access): add V1-06 decideAdminAccessRequest and list-pending service   |

### What exists already

- **Contracts:** `parseDecideAdminAccessRequestRequest`, `parseListPendingAdminAccessRequestsResponse`, types `DecideAdminAccessRequestRequest`, `AdminAccessRequestSummary`, `ListPendingAdminAccessRequestsResponse` — all in `packages/contracts/src/access/access-requests.ts`.
- **Repositories:** `groupAccess.findAdminAccessRequestById`, `decideAdminAccessRequest`, `listPendingAdminAccessRequests`, `promoteToPlatformAdmin` — in `packages/db/src/repositories/group-access.ts`. Plus `identityAccess.setPlatformAdminFlag` for tests.
- **Service:** `decideAdminAccessRequest(command, runner)` and `listPendingAdminAccessRequests(runner)` — in `apps/web/src/features/access/access-service.ts`. Both include their own typed `Repositories` interfaces and pass full RED→GREEN tests.
- **New error code:** `NOT_FOUND` was added to `API_ERROR_CODES` (Task 3). Route layer maps it to HTTP 404.
- **Audit events:** `platform_admin.approved` and `platform_admin.rejected` are written by the service with idempotency key `platform_admin:decide:<requestId>:<decision>`.

### Verified-clean baseline

After Task 3: 46 provider-free Vitest files (225 tests), 7 mobile Jest suites (22 tests), all workspace type checks and lints, db/web/mobile builds pass.

## Remaining tasks and dependency chain

```
T4 (Runtime wiring) ──► T5 (API routes) ──┬─► T6 (Web UI) ──┐
                                          └─► T7 (Mobile UI)─┴─► T8 (Tracker + full verification)
```

- T4 and T5 must run sequentially (T5 depends on T4's runtime wiring).
- T6 and T7 can run **in parallel** after T5 is integrated.
- T8 is integration-only and runs last.

Suggested agent split (per AGENTS.md branch rules):

| Agent             | Task(s)           | Branch                                 |
| ----------------- | ----------------- | -------------------------------------- |
| Backend agent     | T4 then T5        | `workstream/V1-06-decide-runtime-api`  |
| Web UI agent      | T6                | `workstream/V1-06-decide-web-ui`       |
| Mobile UI agent   | T7                | `workstream/V1-06-decide-mobile-ui`    |
| Integration owner | T8 + final squash | `task/V1-06-platform-admin-approval`   |

## Workflow rules (read before starting)

From `AGENTS.md` — non-negotiable:

1. **One agent, one writable branch.** Never check out the same branch in two agents.
2. **Subtask agents commit to their own `workstream/` branch.** They do not push to `task/V1-06-platform-admin-approval` and do not merge their own work.
3. **Integration owner integrates reviewed subtasks one at a time** into `task/V1-06-platform-admin-approval`, running affected checks after each merge.
4. **Only the integration owner edits shared files** (tracker, dependency locks, shared contracts, shared config, ordered migrations).
5. **RED first, then GREEN, then commit.** Use `superpowers:test-driven-development`.
6. **`next-env.d.ts` is auto-generated.** Do not commit changes to it — Next regenerates differently for dev vs build.
7. **`apps/web/.env.local` is gitignored.** It already exists in the main checkout; switching branches keeps it in place because it is not tracked.

## Per-task briefs

### Setup (every agent runs this once)

```bash
# 1. From the main repo, create your branch off the current task branch tip
cd "/Users/fiona/Documents/Apps/Order App"
git switch task/V1-06-platform-admin-approval
git pull --ff-only
git switch -c <your-branch-name>

# 2. Install dependencies (apps/web/.env.local already exists and is preserved across branch switches)
npm ci

# 3. Build shared packages so workspace exports resolve
npm run build --workspaces --if-present

# 4. Verify the baseline is clean (225 tests should pass before you start)
npm run test:unit
```

For provider-backed tests (repositories, service live integration): `set -a && . ./apps/web/.env.local && set +a && RUN_PROVIDER_TESTS=1 npx vitest run --config vitest.config.ts <path>`.

---

### Task 4 + 5 (Backend agent): Runtime wiring + API routes

**Why combined:** T5's route handlers depend on T4's runtime wiring, and the plan even notes T4 is "validated end-to-end by the route-handler tests in Task 5." Splitting them adds an integration step without parallelism benefit.

**Plan reference:** `docs/superpowers/plans/2026-07-30-v1-06-platform-admin-approval.md` lines 872-1295 (Task 4) and 970-1295 (Task 5).

**Files to read first:**

- `apps/web/src/features/access/access-runtime.ts` (98 lines — current runtime)
- `apps/web/src/features/access/access-route-handlers.ts` (existing handlers)
- `apps/web/src/features/access/access-route-handlers.test.ts` (test style)
- `apps/web/src/application/authorize.ts` (authorization helper patterns)
- `apps/web/src/application/execute-route.ts` (route executor + error-to-status map)

**Files to modify:**

- `apps/web/src/features/access/access-service.ts` — extend `AdminDecisionRepositories["access"]` to include `listPendingAdminAccessRequests` (interface only — function already exists)
- `apps/web/src/features/access/access-runtime.ts` — add `decideAdminRequest` and `listPendingAdminRequests` to the `accessRuntime` export

**Files to create:**

- `apps/web/app/api/access/admin-requests/decide/route.ts` — POST endpoint, platform-admin gated
- `apps/web/app/api/access/admin-requests/pending/route.ts` — GET endpoint, platform-admin gated

**Files to modify (handler factories):**

- `apps/web/src/features/access/access-route-handlers.ts` — add `createDecideAdminRequestHandler` and `createListPendingAdminRequestsHandler`
- `apps/web/src/features/access/access-route-handlers.test.ts` — failing tests first

**Authorization pattern:** Each handler uses an `isPlatformAdmin(identity)` check that returns `identity.roles.includes("platform-admin")`. Reject with `PublicApiError("FORBIDDEN", ...)` → HTTP 403 via the existing `executeRoute` machinery.

**Verification:**

```bash
npm run typecheck --workspace @ordah-please/web
npm run lint --workspace @ordah-please/web
npx vitest run --config vitest.config.ts apps/web/src/features/access/access-route-handlers.test.ts
npm run test:unit  # no regressions
npm run build --workspace @ordah-please/web  # route files compile
```

**Commits (two):**

1. `feat(access): wire V1-06 decide and list-pending through accessRuntime`
2. `feat(access): add V1-06 decide and pending admin-request API routes`

---

### Task 6 (Web UI agent): Decision screen + admin nav gate

**Can start after:** Task 5 is integrated into `task/V1-06-platform-admin-approval`.

**Plan reference:** `docs/superpowers/plans/2026-07-30-v1-06-platform-admin-approval.md` lines 1296-1657.

**Files to read first:**

- `apps/web/app/admin/access-requests/page.tsx` (current stub)
- `apps/web/app/admin/layout.tsx` (admin nav gate)
- `apps/web/app/components/*` (existing shell components, EmptyPage)
- `apps/web/app/shell-colors.ts` and `apps/web/app/shell-navigation.ts` (token system)
- `context/design-structure.md` and `context/ui-context.md` (visual rules)
- An existing client component in `apps/web/src/features/access/` for the test pattern

**Files to modify:**

- `apps/web/app/admin/access-requests/page.tsx` — server component, replace stub
- `apps/web/app/admin/layout.tsx` — add server-side platform-admin gate

**Files to create:**

- `apps/web/src/features/access/admin-decision-panel.tsx` — client component ("use client") that calls `/api/access/admin-requests/decide` and `/api/access/admin-requests/pending`
- `apps/web/src/features/access/admin-decision-panel.test.tsx` — web component test (React Testing Library)

**Behavior:**

1. Page is a server component that loads identity. Non-platform-admins see an honest "no access" state.
2. Empty list renders existing EmptyPage with the existing copy.
3. Non-empty list renders one card per request: requester display name, group name, submitted-at, optional reason input, Approve + Reject buttons.
4. Buttons POST to `/api/access/admin-requests/decide` and refresh the list on success.
5. Service errors surface inline with stable user-facing copy.

**Visual rules (non-negotiable, from `design-structure.md`):**

- Light theme, emerald `#0AAE5B` for primary actions, `#EFFAF3` support surface.
- Nunito Sans, tabular numerals for timestamps.
- Touch targets ≥ 44×44 (also enforced for web responsive).
- English-only application-authored copy.
- Reason field is optional for both approve and reject.

**Verification:**

```bash
npm run typecheck --workspace @ordah-please/web
npm run lint --workspace @ordah-please/web
npx vitest run --config vitest.config.ts apps/web/src/features/access/admin-decision-panel.test.tsx
npm run test:unit
npm run build --workspace @ordah-please/web
# Manual: open the admin route in a browser with a platform-admin cookie and verify the list renders
```

**Commit:** `feat(web): add V1-06 platform-admin decision screen and nav gate`

---

### Task 7 (Mobile UI agent): Admin route + Home card

**Can start after:** Task 5 is integrated into `task/V1-06-platform-admin-approval`. **Runs in parallel with Task 6.**

**Plan reference:** `docs/superpowers/plans/2026-07-30-v1-06-platform-admin-approval.md` lines 1658-2170.

**Files to read first:**

- `apps/mobile/app/(member)/index.tsx` (current Home)
- `apps/mobile/src/auth/auth-client.ts` and `authenticated-request.ts` (how mobile hits the API)
- `apps/mobile/__tests__/accept-invitation.test.ts` and `home-screen.test.tsx` (Jest + RNTL pattern)
- `apps/mobile/src/navigation/` (tab structure)
- `apps/mobile/src/theme/` (RN Paper token mapping)
- `context/design-structure.md` (mobile-specific rules)

**Files to create:**

- `apps/mobile/app/admin/access-requests.tsx` — new Expo Router route **outside** `(member)` (not in the tab bar)
- `apps/mobile/src/features/access/admin-decision-panel.tsx` — RN Paper decision UI
- `apps/mobile/__tests__/admin-decision-panel.test.tsx` — Jest + RNTL
- `apps/mobile/__tests__/home-admin-card.test.tsx` — Home card render test

**Files to modify:**

- `apps/mobile/app/(member)/index.tsx` — add a conditional "Platform-admin requests" card at the top, rendered only when `identity.isPlatformAdmin === true`, linking to `/admin/access-requests`

**Behavior:**

1. Mobile decision route mirrors web: list cards, optional reason, Approve/Reject.
2. Hits `/api/access/admin-requests/pending` and `/decide` via the existing `authenticated-request` helper — **cookie only, no bearer token** (matches V1-05 Better Auth Expo pattern).
3. Non-platform-admins see honest no-access state.
4. Home card renders for platform admins only; tapping navigates to `/admin/access-requests`.
5. Card renders even when count is zero (admin can review empty state).

**Mobile-specific rules:**

- React Native Paper components, never raw HTML.
- Lucide icons via `lucide-react-native`.
- Touch targets ≥ 44×44.
- No `EXPO_PUBLIC_*` secrets for this task — public API origin is already wired.

**Verification:**

```bash
npm run typecheck --workspace @ordah-please/mobile
npm run lint --workspace @ordah-please/mobile
npm run test --workspace @ordah-please/mobile
npx expo export --platform android  # from apps/mobile/
```

**Commit:** `feat(mobile): add V1-06 admin decision route and Home card`

---

### Task 8 (Integration owner): Tracker + full verification + squash

**Can start after:** Tasks 4, 5, 6, 7 are all committed on their `workstream/` branches.

**This task runs on the task branch directly** (`task/V1-06-platform-admin-approval`), not on a new workstream branch.

**Steps:**

1. **Integrate reviewed subtask branches one at a time:**

   ```bash
   cd "/Users/fiona/Documents/Apps/Order App"
   git switch task/V1-06-platform-admin-approval
   git merge --ff-only workstream/V1-06-decide-runtime-api
   # run affected checks
   git merge --ff-only workstream/V1-06-decide-web-ui
   # run affected checks
   git merge --ff-only workstream/V1-06-decide-mobile-ui
   # run affected checks
   ```

   Use `--no-ff` if you want an explicit merge commit per subtask. The final squash will erase these.

2. **Update `context/progress-tracker.md`:**
   - Mark V1-06 done in the pending-task list.
   - Add V1-06B (mobile `/team` parity) as a new pending task.
   - Add V1-06 completion evidence in the "Latest V1 Completion Evidence" section.

3. **Run the complete V1-06 verification matrix:**

   ```bash
   npm ci
   npm run build --workspaces --if-present
   npm run typecheck
   npm run lint
   npm run test:unit
   npm run test:mobile

   # Provider-backed:
   set -a && . ./apps/web/.env.local && set +a
   npm run test:providers

   # Builds:
   npm run build --workspace @ordah-please/web
   (cd apps/mobile && npx expo export --platform android)

   # Whitespace / hygiene:
   git diff --check
   prettier --check .

   # Secret scans on built clients:
   # (see existing scripts; mirror V1-05 final verification)
   ```

4. **Live acceptance (web):** With a real platform-admin session, hit `/admin/access-requests`, approve a pending request from another owner, and confirm the requester's `is_platform_admin` flag flips in Neon. Verify exactly one audit row with action `platform_admin.approved`.

5. **Live acceptance (mobile):** From the same admin session in an Android build, navigate from the Home card to `/admin/access-requests` and approve a request. Verify the same Neon + audit outcomes.

6. **Squash-merge to `main`:**

   ```bash
   git checkout main
   git merge --squash task/V1-06-platform-admin-approval
   git commit -m "V1-06 Implement platform-admin approval and limited mobile-admin permissions"
   ```

   The squash commit title must match the progress tracker entry **exactly**.

7. **Verify `main` and push:**

   ```bash
   npm ci && npm run test:unit && npm run test:mobile
   git push origin main
   ```

8. **Cleanup:** Delete the subtask branches only after the squash commit is verified on `main`. Per AGENTS.md, keep the task branch as a recovery reference until the squash is verified and pushed.

## Handoff prompts

Copy-paste one of these into a new Claude Code session to start an agent on a specific task. The agent should invoke `superpowers:test-driven-development`.

### Backend agent prompt (Tasks 4 + 5)

```text
You are picking up V1-06 Tasks 4 and 5 (runtime wiring + API routes) on the ordah-please project.

Read in order:
1. AGENTS.md and CLAUDE.md at the repo root
2. docs/superpowers/handoffs/2026-07-31-v1-06-remaining-tasks.md (this handoff)
3. docs/superpowers/plans/2026-07-30-v1-06-platform-admin-approval.md lines 872-1295
4. The files listed in the "Task 4 + 5" brief

Setup: from the main repo, create branch workstream/V1-06-decide-runtime-api off task/V1-06-platform-admin-approval and switch to it. apps/web/.env.local is already in place (gitignored). npm ci, build packages.

Do Task 4 first (runtime wiring), commit it, then Task 5 (route handlers + tests RED-first, then API route files). Commit each. Run typecheck/lint/tests after each step. Do NOT merge into task/V1-06-platform-admin-approval — push your workstream branch with git push -u origin workstream/V1-06-decide-runtime-api and report the SHA when done.
```

### Web UI agent prompt (Task 6)

```text
You are picking up V1-06 Task 6 (web platform-admin decision screen) on the ordah-please project.

Prerequisite: Tasks 4+5 must already be merged into task/V1-06-platform-admin-approval. Confirm by checking that apps/web/app/api/access/admin-requests/{decide,pending}/route.ts exist on that branch.

Read in order:
1. AGENTS.md and CLAUDE.md at the repo root
2. docs/superpowers/handoffs/2026-07-31-v1-06-remaining-tasks.md (this handoff)
3. docs/superpowers/plans/2026-07-30-v1-06-platform-admin-approval.md lines 1296-1657
4. context/design-structure.md and context/ui-context.md (visual rules)
5. The files listed in the "Task 6" brief

Setup: from the main repo, create branch workstream/V1-06-decide-web-ui off task/V1-06-platform-admin-approval and switch to it. apps/web/.env.local is already in place (gitignored). npm ci, build packages.

Write component tests RED-first, implement the decision panel client component, replace the admin/access-requests stub with a server component that uses it, and gate the admin layout. Commit when typecheck/lint/tests/build all pass. Do NOT merge into task/V1-06-platform-admin-approval — push your workstream branch and report the SHA.
```

### Mobile UI agent prompt (Task 7)

```text
You are picking up V1-06 Task 7 (mobile admin route + Home card) on the ordah-please project.

Prerequisite: Tasks 4+5 must already be merged into task/V1-06-platform-admin-approval. Confirm by checking that apps/web/app/api/access/admin-requests/{decide,pending}/route.ts exist on that branch. Task 7 runs in parallel with Task 6 — do not wait for it.

Read in order:
1. AGENTS.md and CLAUDE.md at the repo root
2. docs/superpowers/handoffs/2026-07-31-v1-06-remaining-tasks.md (this handoff)
3. docs/superpowers/plans/2026-07-30-v1-06-platform-admin-approval.md lines 1658-2170
4. context/design-structure.md (mobile rules)
5. The files listed in the "Task 7" brief

Setup: from the main repo, create branch workstream/V1-06-decide-mobile-ui off task/V1-06-platform-admin-approval and switch to it. npm ci, build packages.

Write Jest+RNTL tests RED-first, implement the new /admin/access-requests.tsx route outside (member), the decision panel component, and the conditional Home card. Cookie-only auth via authenticated-request helper — never add a bearer token. Commit when typecheck/lint/mobile tests/Android export all pass. Do NOT merge into task/V1-06-platform-admin-approval — push your workstream branch and report the SHA.
```

### Integration owner prompt (Task 8)

```text
You are the integration owner for V1-06 final completion on the ordah-please project.

Read in order:
1. AGENTS.md (especially the permanent-history rules)
2. docs/superpowers/handoffs/2026-07-31-v1-06-remaining-tasks.md (this handoff)
3. context/progress-tracker.md (current state)

You will work on branch task/V1-06-platform-admin-approval in the main checkout. The completed workstream branches workstream/V1-06-decide-runtime-api, workstream/V1-06-decide-web-ui, and workstream/V1-06-decide-mobile-ui should already be pushed.

Integrate them one at a time with affected checks after each merge. Update context/progress-tracker.md (V1-06 done, V1-06B added). Run the complete verification matrix from the "Task 8" brief. Run live web and mobile acceptance against a real platform-admin session. Squash-merge to main with the exact title "V1-06 Implement platform-admin approval and limited mobile-admin permissions". Verify main, push, and only then delete the subtask branches.
```
