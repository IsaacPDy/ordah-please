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
│   │   │   ├── (member)/       # Native Home, Orders, Favorites, and Groups tab views
│   │   │   └── invite/         # Better Auth Google deep-link onboarding
│   │   └── src/
│   │       ├── auth/           # SecureStore cookie client and authenticated request boundary
│   │       ├── components/     # Shared native member-page and access-screen composition
│   │       ├── features/access/# Cookie-authenticated identity gate, multi-membership states, invitations, and admin access UI
│   │       ├── navigation/     # Shared member-tab labels, icons, and runtime styles
│   │       └── theme/          # React Native Paper mapping to shared tokens
│   └── web/                    # Next.js App Router shell for the PWA, admin portal, and API
│       ├── app/
│       │   ├── (member)/       # Responsive Home, Orders, Favorites, and multi-group views
│       │   ├── admin/          # Overview, users/permissions, groups, catalog, import, refresh, access, and audit views
│       │   ├── api/access/     # Authenticated invitation, membership, and admin-request routes
│       │   ├── api/auth/       # Better Auth handler and Google OAuth callback
│       │   ├── api/webhooks/   # Public signature-verified callbacks for non-auth providers
│       │   ├── components/     # Web member/admin shells and reusable Groups/admin-page views
│       │   ├── invite/         # PWA invitation sign-in and acceptance route
│       │   ├── shell-colors.ts # Accessible semantic color pairings for approved tokens
│       │   └── shell-navigation.ts # Separate member and admin destination definitions
│       └── src/
│           ├── application/    # Ordered route execution plus exact-group authorization in group-authorization.ts
│           ├── auth/           # Better Auth, multi-membership identity, and request-cached gates in load-server-page-identity.ts
│           └── features/access/# Access policies, route composition, and PWA access views
├── packages/
│   ├── contracts/              # Strict API parsers, including the shared multi-membership identity summary
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
│   │       ├── dev/            # Deterministic fixtures plus guarded seed and auth-identity-link CLIs
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
│   ├── services/                # Service inventory, setup, limits, and stack glossary
│   │   ├── services.md          # Simple list of services and their contributions
│   │   ├── service-setup.md     # Provider setup, variables, and rename/rotation checklists
│   │   ├── service-limits.md    # Free-tier allowances and warning thresholds
│   │   └── technology-reference.md # Plain-language explanation of each technology
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

The current UI baseline replaces the original empty member shells with Home, Orders, Favorites, and Groups views on web/PWA and native mobile. Groups now renders the signed-in account's real membership IDs and exact roles from the protected identity boundary; group names, member rosters, and order details remain deferred instead of being invented. The web admin shell contains the approved eight desktop destinations and limits mobile navigation to Groups, Catalog, Access Requests, and Audit Log. Upcoming journey bundles connect the remaining catalog, permission, order, receipt, and notification behavior.

## Ownership Rules

- Apps render interfaces and call shared domain or API contracts; they do not own business rules.
- `packages/domain` contains plain TypeScript and does not import React, Next.js, Expo, Better Auth, Neon, or provider SDKs.
- `packages/db` does not decide permissions or product behavior; it persists decisions made by domain services.
- Provider packages expose small interfaces so R2, OneSignal, or QStash can be replaced without rewriting the product.
- API route handlers authenticate, validate, authorize, call one use case, and translate the result into a response.
- Server-rendered member and admin layouts load one request-cached application identity before rendering protected navigation; child pages reuse that boundary instead of querying auth or Neon again.
- `context/assets/ordah-please-option-1.png` is the approved V1 member-screen visual reference; implementation should reproduce its hierarchy and visual language without treating the bitmap as application UI.
- `context/services/service-setup.md` owns provider setup steps, variable names, environment placement, and rename/rotation checklists; it never stores real credential values. `services.md`, `service-limits.md`, and `technology-reference.md` sit alongside it under `context/services/`.

## File Size and Splitting

- Prefer one clear responsibility per module.
- Split a file when it owns unrelated business rules, multiple screens, or multiple provider concerns.
- Keep route files thin; move reusable logic into packages.
- Do not create generic utility files that collect unrelated functions.
