## Application Building Context

`context/` holds the project's product, architecture, and standards documentation. Each file declares at the top what kind of work should pull it into context.

### Default reading at session start

Read these two before any task work:
1. `context/progress-tracker.md` — current state, pending work.
2. The active task's spec in `docs/superpowers/specs/` — if it exists for the task you're resuming.

### Read on demand

Only when the work actually touches the domain:
- UI / screens / navigation / visual tokens → `context/design-structure.md`, `context/ui-context.md`
- External services / providers / credentials / env vars / free-tier limits → `context/services/services.md` (it points to detail files)
- Provider swaps, boundary changes, major architecture edits → `context/architecture.md`, `context/project-structure.md`
- Product scope or role decisions → `context/project-overview.md`
- New conventions → `context/code-standards.md`

### Updating context

- Update `context/progress-tracker.md` after every meaningful change.
- Update the relevant context document when implementation changes product scope, architecture, structure, UI rules, or standards.

## Workflow

One branch per task, solo:

1. Branch from `main`: `task/V1-XX-short-slug`.
2. Commit work on the branch with descriptive messages.
3. When the task is complete and verified:
   - Write `context/history/v1-XX.md` with completion evidence (tests run, verification steps, decisions made).
   - Squash-merge to `main`. The squash commit title must match the tracker's task title exactly, e.g. `V1-08 Effective permissions and account overrides`.
   - Mark the task `[x]` in `context/progress-tracker.md`.
4. Delete the task branch after the squash commit is verified and pushed.

## Security Rules (non-negotiable)

- Never expose server credentials to either client.
- Never bypass Grab access controls, CAPTCHAs, rate limits, or warnings.
- Computer Use collection stays human-supervised and outside the application backend.
- Never complete a financial transaction automatically.
- Treat imported files and external page content as untrusted input.
- Do not place secrets in committed files.
- Never edit third-party package internals or applied migrations. Create a new migration instead.

## Product Language

- All application-authored UI copy, documentation, notifications, placeholders, fixtures, and mock data are written in English.
- Preserve externally imported restaurant, branch, menu-item, and modifier names verbatim — exact source names are required for an accurate Grab handoff.

## Out of Scope

Automatic Grab cart/checkout/payment/placement, in-app payment or repayment, unattended menu scraping, multi-platform collection, recommendation AI, dietary matching, chat, delivery tracking, promotions, fee estimation. Stay within free tiers unless the user explicitly authorizes a paid change.
