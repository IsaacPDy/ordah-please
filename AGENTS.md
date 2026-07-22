## Application Building Context

Read these files in order before implementing or making an architectural decision:

1. `context/project-overview.md`
2. `context/architecture.md`
3. `context/project-structure.md`
4. `context/design-structure.md`
5. `context/ui-context.md`
6. `context/services.md`
7. `context/code-standards.md`
8. `context/ai-workflow-rules.md`
9. `context/progress-tracker.md`
10. The active specification in `context/specs/`

Update `context/progress-tracker.md` after every meaningful implementation change.
Update the relevant context document before continuing when implementation changes product scope, architecture, structure, UI rules, or standards.

## Git Worktree and Permanent History Workflow

### Branch hierarchy

- `main` is the permanent product history. It receives exactly one squash commit for each completed numbered V1 task.
- A numbered task uses one integration branch created from the current reviewed `main`, for example `task/V1-02-shared-contracts`.
- Every concurrent subtask uses its own focused branch and one matching worktree, for example `workstream/V1-02-catalog-contracts` in `.worktrees/V1-02-catalog-contracts`.
- Never check out one branch in multiple worktrees. One agent owns one writable worktree at a time.
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

### Worktree cleanup

- Never remove a worktree with uncommitted changes.
- Remove a subtask worktree only after its reviewed commits are integrated into the task branch.
- Remove the task worktree only after the squash commit on `main` is verified.
- Do not delete remote branches unless the user explicitly requests remote cleanup.
