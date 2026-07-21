# Project Structure

## Current Repository Layout

```text
Order App/                        # Current workspace; project slug is ordah-please
├── .env.example                # Approved variable names only; no real values
├── .nvmrc                      # Shared Node.js version
├── AGENTS.md
├── apps/
│   ├── mobile/                 # Expo Router Android shell and fixed application identity
│   │   └── app/                # Mobile routes; feature routes are added by later tasks
│   └── web/                    # Next.js App Router shell for the PWA, admin portal, and API
│       └── app/                # Web routes; member, admin, and API groups are added later
├── packages/
│   ├── contracts/              # Buildable shell for shared validation and API shapes
│   ├── db/                     # Buildable shell for Neon schema, migrations, and queries
│   ├── domain/                 # Buildable shell for business rules and state transitions
│   ├── jobs/                   # Buildable shell for QStash scheduling and handlers
│   ├── notifications/          # Buildable shell for notification events and OneSignal
│   ├── storage/                # Buildable shell for R2 signed URLs and object naming
│   └── ui/                     # Buildable shell for cross-client tokens and primitives
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
├── eslint.config.mjs           # Shared strict lint rules
├── package.json                # npm workspaces and repository-wide commands
├── package-lock.json           # One reproducible dependency graph for every workspace
└── tsconfig.base.json          # Strict TypeScript rules inherited by apps and packages
```

Task 0.1 creates only the framework and package boundaries. Feature folders from the approved implementation plan are added by the task that first owns their behavior, which keeps the foundation free of invented placeholder architecture.

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
