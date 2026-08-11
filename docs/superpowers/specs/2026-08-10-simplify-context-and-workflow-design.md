# Simplify Context Loading and Workflow

**Date:** 2026-08-10
**Status:** Design — awaiting user review

## Problem

Each session of continuing work on a single V1 task currently loads roughly 930 lines of mandatory context (six files in `context/` plus the active spec) before any actual work happens. The workflow rules in `AGENTS.md` and `context/ai-workflow-rules.md` describe a multi-agent branch ceremony (integration owners, subtask branches, one-agent-one-writable-branch, per-subtask progress commits) that the user does not use — they work solo, one task at a time. The token cost of just resuming a task is too high.

## Goals

1. Cut per-session context loading by roughly 60%.
2. Remove workflow ceremony that does not match how the user actually works.
3. Move completed and reference-only material out of the active read surface without losing information.

## Non-Goals

- Refactoring the application code itself.
- Changing the product scope or any decision recorded in `context/`.
- Removing the per-task history pattern in `context/history/` — it is already small and useful.

## Design

### New reading model

The current `AGENTS.md` mandates reading six files in order before any work. The new model is:

| When                              | Read                                                                 |
| --------------------------------- | -------------------------------------------------------------------- |
| Session start, any task           | `context/progress-tracker.md` + active task spec in `docs/superpowers/specs/` (if it exists) |
| Work touches UI/screens           | `context/design-structure.md`, `context/ui-context.md`               |
| Work touches external services    | `context/services/services.md` + the relevant provider section       |
| Work changes providers/boundaries | `context/architecture.md`, `context/project-structure.md`            |
| On demand                         | `context/project-overview.md`, `context/code-standards.md`           |

Files that are NOT read by default: `context/ai-workflow-rules.md` (kept, no longer pointed at), `context/project-overview.md`, `context/code-standards.md`.

### New workflow

One branch per task. Commit as you go. Squash to main when done.

```
1. Branch: task/V1-XX-short-slug, created from latest main.
2. Implement, commit on the branch with clear messages.
3. Update context/progress-tracker.md as work progresses.
4. When the task is complete and verified:
   a. Write context/history/v1-XX.md with completion evidence.
   b. Squash-merge to main with the exact task title from the tracker.
   c. Update the tracker to mark the task [x].
5. Delete the task branch once the squash is verified and pushed.
```

No integration owners. No subtask branches. No parallel-agent rules.

### File changes

**Move to `context/archive/`:**
- `context/product-decisions-questionnaire.md` (437 lines, referenced only as a historical artifact by the master implementation plan).

**Keep in place, on-demand reading only:**
- `context/architecture.md`
- `context/project-overview.md`
- `context/project-structure.md`
- `context/code-standards.md`
- `context/design-structure.md`, `context/ui-context.md`
- `context/services/*`

**Keep as session-start read:**
- `context/progress-tracker.md`

**Keep untouched:**
- `context/ai-workflow-rules.md` (user declined deletion; it remains on disk but the new AGENTS.md will not direct sessions to read it).
- `context/history/*` (per-task completion evidence; pattern is useful and small).

**Delete:**
- `.worktrees/` (empty directory).
- `docs/superpowers/plans/2026-08-03-group-details-creation-and-invites.md` (stale plan from a prior session, task is complete).

### AGENTS.md rewrite

Current `AGENTS.md` is ~80 lines and contains an extensive "Permanent History Workflow" section describing multi-agent integration rules. The rewrite below replaces it.

```markdown
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
```

## Estimated savings

- Per-session reading at task resume: ~930 lines → ~360 lines (~60% reduction).
- AGENTS.md: ~80 lines → ~55 lines, with the multi-agent workflow section removed.
- ~437 lines of reference-only material moved to `context/archive/`.

## Verification

After implementation:
1. New AGENTS.md is in place; old workflow section is gone.
2. `context/archive/product-decisions-questionnaire.md` exists; original location no longer has it.
3. `.worktrees/` and the stale plan file are deleted.
4. A fresh session resuming a V1 task loads only `progress-tracker.md` + active spec by default.
5. Git history is clean (one commit per discrete change, no force pushes, no main-branch rewrites).

## Risks

- **Future Claude sessions may re-grow the workflow ceremony.** Mitigation: the new AGENTS.md explicitly describes the solo workflow. If a session proposes adding parallel-agent rules, push back unless the user has actually adopted that working style.
- **Forgetting where the questionnaire went.** Mitigation: the file used to be referenced by the master implementation plan at `context/specs/01-v1-implementation-plan.md`, but that file is already deleted (user removed the specs folder), so there are no live references to update. The archived copy is sufficient.
