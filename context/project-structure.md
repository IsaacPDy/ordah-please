# Project Structure

## Planned Repository Layout

```text
Order App/                        # Current workspace; project slug is ordah-please
├── AGENTS.md
├── apps/
│   ├── mobile/                 # Expo Android application
│   └── web/                    # Next.js iPhone PWA, admin portal, and API
├── packages/
│   ├── contracts/              # Shared validation and API shapes
│   ├── db/                     # Neon schema, migrations, and queries
│   ├── domain/                 # Business rules and state transitions
│   ├── jobs/                   # QStash scheduling and handlers
│   ├── notifications/          # Notification events and OneSignal adapter
│   ├── storage/                # R2 signed URLs and object naming
│   └── ui/                     # Approved cross-client design tokens and primitives
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
└── package.json                # Workspace scripts and shared tooling
```

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
