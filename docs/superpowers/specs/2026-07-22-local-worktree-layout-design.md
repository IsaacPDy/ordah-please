# Local Worktree Layout Design

## Goal

Keep every concurrent agent checkout inside the repository's primary folder without allowing nested worktree files to appear in Git status or enter commits.

## Directory Convention

All auxiliary Git worktrees live under the ignored root directory `.worktrees/`.

Each worktree directory uses the main feature or engineering field being changed, written in lowercase kebab case. The directory name describes the work rather than the agent, chat, or temporary task number.

```text
Order App/
└── .worktrees/
    ├── workspace-foundation/
    ├── quality-foundation/
    ├── ui-foundation/
    └── domain-primitives/
```

The existing worktrees move as follows:

| Current checkout                                 | New checkout                      |
| ------------------------------------------------ | --------------------------------- |
| `/private/tmp/ordah-please-worktrees/foundation` | `.worktrees/workspace-foundation` |
| `/private/tmp/ordah-please-worktrees/quality`    | `.worktrees/quality-foundation`   |
| `/private/tmp/ordah-please-worktrees/ui`         | `.worktrees/ui-foundation`        |
| `/private/tmp/ordah-please-worktrees/domain`     | `.worktrees/domain-primitives`    |

## Branch and Ownership Rules

- `main` is the permanent product history. It receives exactly one squash commit for each completed numbered V1 task.
- Every numbered task receives one integration branch created from the reviewed head of `main`.
- Every concurrent subtask or field receives its own focused branch and one matching worktree under `.worktrees/`, created from the task integration branch.
- Use a descriptive branch such as `workstream/v1-02-catalog-import` and a matching checkout such as `.worktrees/v1-02-catalog-import`.
- One agent owns a writable worktree at a time. Agents never share the same writable checkout.
- Branch and worktree names describe the task or field, not the assigned agent.
- Subtask owners make focused progress commits on their branches. Those commits are useful review and recovery points, but they are not permanent `main` history.
- The task integration owner alone merges reviewed subtasks and updates integration-sensitive files such as `context/progress-tracker.md`, root dependency locks, shared configuration, and ordered database migrations unless the task explicitly assigns one of those files.
- When the entire numbered task passes integrated verification, the integration owner squash-merges the task branch into `main` and uses the task's exact progress-tracker title as the commit message.
- The next numbered task branch starts from the updated `main`, never from an unmerged predecessor task branch.

## Agent Workflow

1. Read the required repository context and active specification.
2. Create the numbered task integration branch from the reviewed head of `main`.
3. Create each subtask branch from the task branch and its matching worktree under `.worktrees/<task-and-field>`.
4. Implement and verify the focused subtask inside that worktree.
5. Commit the completed subtask and report its name, changed files, integration-sensitive changes, tests, and any service gate.
6. Receive independent review and resolve every Critical and Important finding on the subtask branch.
7. Merge reviewed subtask branches one at a time into the numbered task integration branch.
8. Run the full affected integrated checks from the task integration branch.
9. Squash-merge the verified task branch into `main` and commit with the task's exact progress-tracker title.
10. Create the next numbered task branch from the updated `main`.
11. Prune each worktree only after its commits are integrated and the required verification succeeds.

## Permanent Main History

The final integration step deliberately compresses all subtask and task-branch progress into one permanent commit:

```bash
git switch main
git merge --squash <completed-task-branch>
git commit -m "V1-02 Define shared API contracts and provider-neutral domain types"
```

The commit message must exactly match the numbered task title in `context/progress-tracker.md`. Internal task and subtask commits remain available on their source branches until cleanup, but they do not appear as separate commits on `main`.

## Pruning Safety

- Never prune a worktree with uncommitted changes.
- Never delete a subtask branch containing commits that are not reachable from the numbered task integration branch or a published recovery reference.
- Before pruning a subtask worktree, verify it is clean and its reviewed branch is integrated into the numbered task branch.
- Remove the worktree with `git worktree remove .worktrees/<task-and-field>`.
- Delete a local subtask branch with normal `git branch -d` only after Git confirms it is merged into the task branch.
- A squash commit does not make the task branch's individual commits ancestors of `main`. Keep the task branch until the squash result is verified and pushed or another durable recovery reference exists.
- Delete the task branch later only as an explicit cleanup action. Git may require `git branch -D` because squash equivalence is not ancestry; inspect and verify the target before using that command.
- Delete a remote branch only when the user requests remote cleanup or the repository workflow explicitly requires it.
- If verification fails after merge, keep the worktree and branch available for the repair.

## Repository Documentation Changes

- Add `/.worktrees/` to `.gitignore` while preserving the existing `.DS_Store` ignore rule.
- Add the local worktree container to `context/project-structure.md` as an ignored development-only directory.
- Add the creation, ownership, merge, verification, and pruning policy to `AGENTS.md` and `context/ai-workflow-rules.md`.
- Record the completed repository-workflow change in `context/progress-tracker.md`.

## Failure Handling

- Stop before moving a worktree if its checkout is dirty.
- Stop if a target directory already exists or is registered to another worktree.
- Use `git worktree move` so Git updates its administrative metadata rather than moving files manually.
- Verify every new path with `git worktree list` after the moves.
- Confirm the primary checkout still tracks the active milestone branch and that `.worktrees/` is ignored.

## Verification

The change is complete when:

1. All four existing worktrees appear under `.worktrees/` in `git worktree list`.
2. The old `/private/tmp/ordah-please-worktrees/` paths are no longer registered.
3. `git check-ignore -v .worktrees/` identifies the repository ignore rule.
4. `git status --short` does not list the nested worktree directories.
5. `AGENTS.md`, `context/project-structure.md`, `context/ai-workflow-rules.md`, and `context/progress-tracker.md` describe the same workflow.
6. The active `v1-02` checkout and every moved feature worktree retain their original branch and commit.
7. A completed numbered task reaches `main` as one squash commit whose message exactly matches its progress-tracker title.
