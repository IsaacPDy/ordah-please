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
│       └── app/
│           ├── (member)/       # Responsive member Home, Orders, Favorites, and Team shells
│           ├── admin/          # Separate desktop/responsive admin navigation shell
│           ├── components/     # Web-only shell navigation and honest empty states
│           ├── shell-colors.ts # Accessible semantic color pairings for approved tokens
│           └── shell-navigation.ts # Separate member and admin destination definitions
├── packages/
│   ├── contracts/              # Strict catalog, favorite, order, and common API boundary parsers
│   │   └── src/
│   │       ├── catalog/        # Immutable catalog response validation
│   │       ├── common/         # API envelopes, errors, pagination, and strict JSON helpers
│   │       ├── favorites/      # Complete favorite-combination validation
│   │       └── orders/         # Food snapshots, strict mutation requests, handoff, receipt, and history validation
│   ├── db/                     # Buildable shell for Neon schema, migrations, and queries
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

Tasks 0.1 through 0.3 create the framework, quality, and visual-shell boundaries. Task 0.3 adds only accessible empty navigation surfaces and shared visual tokens. Task 1.1 adds shared primitives and API envelopes; Task 1.2 adds provider-neutral catalog, favorite, order, and history shapes plus strict runtime parsers. Feature folders from the approved implementation plan are added by the task that first owns their behavior, which keeps the foundation free of invented placeholder architecture.

## Ownership Rules

- Apps render interfaces and call shared domain or API contracts; they do not own business rules.
- `packages/domain` contains plain TypeScript and does not import React, Next.js, Expo, Clerk, Neon, or provider SDKs.
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
