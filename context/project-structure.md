# Project Structure

## Current Repository Layout

```text
Order App/                        # Current workspace; project slug is ordah-please
├── .env.example                # Approved variable names only; no real values
├── .github/workflows/ci.yml    # Provider-free repository quality gates
├── .nvmrc                      # Shared Node.js version
├── AGENTS.md
├── apps/
│   ├── mobile/                 # Expo Router Android shell and fixed application identity
│   │   ├── __tests__/          # Jest/React Native Testing Library component tests
│   │   ├── app/
│   │   │   └── (member)/       # Home, Orders, Favorites, and Team tab shells
│   │   └── src/
│   │       ├── components/     # Dynamic-text-safe native shell composition
│   │       ├── navigation/     # Shared member-tab labels, icons, and runtime styles
│   │       └── theme/          # React Native Paper mapping to shared tokens
│   └── web/                    # Next.js App Router shell for the PWA, admin portal, and API
│       ├── app/
│       │   ├── (member)/       # Responsive member Home, Orders, Favorites, and Team shells
│       │   ├── admin/          # Separate desktop/responsive admin navigation shell
│       │   ├── api/auth/       # Better Auth handler and Google OAuth callback
│       │   ├── api/webhooks/   # Public signature-verified callbacks for non-auth providers
│       │   ├── components/     # Web-only shell navigation and honest empty states
│       │   ├── shell-colors.ts # Accessible semantic color pairings for approved tokens
│       │   └── shell-navigation.ts # Separate member and admin destination definitions
│       └── src/
│           ├── application/    # Ordered validation, authorization, use-case, and API-result execution
│           └── auth/           # Better Auth server/client composition, session verification, and product identity loading
├── packages/
│   ├── contracts/              # Strict catalog, favorite, order, and common API boundary parsers
│   │   └── src/
│   │       ├── catalog/        # Immutable catalog response validation
│   │       ├── common/         # API envelopes, errors, pagination, and strict JSON helpers
│   │       ├── favorites/      # Complete favorite-combination validation
│   │       └── orders/         # Food snapshots, strict mutation requests, handoff, receipt, and history validation
│   ├── db/                     # Drizzle-owned Neon schema and generated migration history
│   │   ├── drizzle/            # Generated SQL migrations and Drizzle metadata
│   │   ├── drizzle.config.ts   # Direct migration connection and schema-generation paths
│   │   └── src/
│   │       ├── client.ts       # Validated pooled server connection composition
│   │       ├── dev/            # Deterministic fictional fixtures, guarded CLI, and idempotency proof
│   │       ├── transaction.ts  # Atomic multi-record operation boundary
│   │       ├── repositories/   # Focused persistence-only data access interfaces
│   │       └── schema/         # Identity, files, catalog, ordering, operations, and provider verification
│   ├── domain/                 # Provider-neutral catalog, favorite, order, and primitive types
│   │   └── src/
│   │       ├── catalog/        # Published menu and availability read models
│   │       ├── favorites/      # Branch-scoped combinations and rank-replacement policy
│   │       ├── orders/         # Order types plus voting, deadline, transition, and handoff policies
│   │       └── types/          # Branded IDs, centavos, roles, and UTC timestamps
│   ├── jobs/                   # Buildable shell for QStash scheduling and handlers
│   ├── notifications/          # Buildable shell for notification events and OneSignal
│   ├── storage/                # Buildable shell for R2 signed URLs and object naming
│   └── ui/                     # Shared semantic colors, spacing, radii, typography, elevation, and touch targets
├── context/
│   ├── assets/                 # Approved visual references used during implementation
│   ├── specs/
│   ├── project-overview.md
│   ├── architecture.md
│   ├── project-structure.md
│   ├── design-structure.md
│   ├── ui-context.md
│   ├── services.md
│   ├── service-limits.md
│   ├── code-standards.md
│   ├── ai-workflow-rules.md
│   └── progress-tracker.md
├── eslint.config.mjs           # Root lint scope and generated-output ignores
├── eslint.shared.mjs           # Strict typed rules composed with each framework preset
├── package.json                # npm workspaces and repository-wide commands
├── package-lock.json           # One reproducible dependency graph for every workspace
├── tests/e2e/                  # Playwright member/admin browser projects
├── tsconfig.json               # Root test and tool configuration type checking
├── tsconfig.base.json          # Strict TypeScript rules inherited by apps and packages
└── vitest.config.ts            # Node test projects and clean-clone workspace source resolution
```

Tasks 0.1 through 0.3 create the framework, quality, and visual-shell boundaries. Task 0.3 adds only accessible empty navigation surfaces and shared visual tokens. Task 1.1 adds shared primitives and API envelopes; Task 1.2 adds provider-neutral catalog, favorite, order, and history shapes plus strict runtime parsers. Task 2.1 realizes those rules as focused Drizzle schema modules and a generated PostgreSQL migration while keeping provider access out of clients and domain code. Task 2.2 adds pooled server composition, transaction-scoped repository composition, and persistence-only interfaces without moving authorization or workflow rules into the database package. Task 2.3 adds development-only deterministic fixtures whose guarded transactional reruns restore the same fictional group and reviewed menu without duplicates. Task 3.1 originally added the trusted API boundary with Clerk. V1-04A replaces that provider-specific layer with Better Auth tables, server/client composition, session verification, first-request product identity provisioning, and no external identity webhook while preserving the ordered authorization executor and immutable product history. Old generated migrations remain unchanged as historical evidence.

## Ownership Rules

- Apps render interfaces and call shared domain or API contracts; they do not own business rules.
- `packages/domain` contains plain TypeScript and does not import React, Next.js, Expo, Better Auth, Neon, or provider SDKs.
- `packages/db` does not decide permissions or product behavior; it persists decisions made by domain services.
- Provider packages expose small interfaces so R2, OneSignal, or QStash can be replaced without rewriting the product.
- API route handlers authenticate, validate, authorize, call one use case, and translate the result into a response.
- `context/assets/ordah-please-option-1.png` is the approved V1 member-screen visual reference; implementation should reproduce its hierarchy and visual language without treating the bitmap as application UI.
- `context/services.md` owns provider setup steps, variable names, environment placement, and rename/rotation checklists; it never stores real credential values.

## File Size and Splitting

- Prefer one clear responsibility per module.
- Split a file when it owns unrelated business rules, multiple screens, or multiple provider concerns.
- Keep route files thin; move reusable logic into packages.
- Do not create generic utility files that collect unrelated functions.
