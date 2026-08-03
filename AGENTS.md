## Application Building Context

Read these files in order before implementing or making an architectural decision:

1. `context/ai-workflow-rules.md`
2. `context/architecture.md`
3. `context/code-standards.md`
4. `context/progress-tracker.md`
5. `context/project-overview.md`
6. `context/project-structure.md`
7. The active specification in `context/specs/`

Read these files only when the work touches their domain:

- `context/services/` (services, service-setup, service-limits, technology-reference) — read before any work involving external services outside the codebase (service inventory, provider setup, credentials, environment variables, free-tier limits, or rename/rotation checklists).
- `context/ui-context.md` and `context/design-structure.md` — read before any UI work (screens, navigation, components, visual tokens, or layout).

Update `context/progress-tracker.md` after every meaningful implementation change.
Update the relevant context document before continuing when implementation changes product scope, architecture, structure, UI rules, or standards.

## Permanent History Workflow

### Branch hierarchy

- `main` is the permanent product history. It receives exactly one squash commit for each completed numbered V1 task.
- A numbered task uses one integration branch created from the current reviewed `main`, for example `task/V1-02-shared-contracts`.
- Subtask work, when it needs isolation, uses focused branches off the task branch, for example `workstream/V1-02-catalog-contracts`. One agent owns one writable branch at a time.
- The task integration branch has one integration owner. Subtask agents do not commit directly to it and do not merge their own work.

### Subtask progress commits

1. The integration owner defines each subtask's file ownership and verification requirement before parallel work begins.
2. Each subtask agent implements, tests, and commits its focused work on its own branch. The commit message describes that subtask and acts as its progress report.
3. Each subtask reports its commit SHA, changed files, tests, documentation changes, integration-sensitive files, and service gates.
4. Critical and Important review findings are fixed on the subtask branch before integration.
5. The integration owner integrates reviewed subtask branches into the task branch one at a time and runs affected checks after every integration.
6. Only the integration owner edits shared integration files such as `context/progress-tracker.md`, dependency locks, shared contracts, shared configuration, and ordered migrations unless ownership was explicitly assigned.

### One permanent commit per V1 task

1. After all subtasks are integrated, run the complete task verification on the task branch and update the tracker.
2. Squash-merge the completed task branch into `main`; do not preserve its internal progress commits on `main`.
3. The squash commit message must exactly match the numbered tracker task title, for example:

```text
V1-02 Define shared API contracts and provider-neutral domain types
```

4. Confirm `main` contains the complete task result and passes integrated verification.
5. Create the next numbered task branch from the updated `main`, never from the previous task branch. Dependency-aware exceptions require explicit user approval.
6. Keep the completed task branch as a recovery reference until the squash commit is verified and pushed. Because Git cannot detect squash equivalence, delete that branch later only as an explicit cleanup action.

### Branch cleanup

- Do not delete remote branches unless the user explicitly requests remote cleanup.
