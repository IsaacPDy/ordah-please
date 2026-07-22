# Squash-Merge Worktree Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make concurrent subtask work safe while keeping exactly one permanent commit per numbered V1 task on `main`.

**Architecture:** `main` owns permanent task-level history. Each numbered V1 task has one integration branch, while every concurrent subtask has a unique branch and worktree. Reviewed subtask commits are integrated into the task branch, and the completed task branch is squash-merged to `main` with the exact tracker task title.

**Tech Stack:** Git branches, Git worktrees, Markdown repository instructions

---

### Task 1: Document the branch and history hierarchy

**Files:**

- Create: `docs/superpowers/plans/2026-07-22-squash-worktree-workflow.md`
- Modify: `AGENTS.md`
- Modify: `context/ai-workflow-rules.md`
- Modify: `docs/superpowers/specs/2026-07-22-local-worktree-layout-design.md`
- Modify: `context/progress-tracker.md`

- [x] **Step 1: Add the permanent-history rule**

Document that `main` receives one squash commit per numbered V1 task and that its commit message exactly matches the tracker title, such as `V1-02 Define shared API contracts and provider-neutral domain types`.

- [x] **Step 2: Add the concurrent worktree rule**

Document one task integration branch, one unique subtask branch per worktree, one writable owner per worktree, and no concurrent checkout of the same branch.

- [x] **Step 3: Add the integration sequence**

Document subtask commit, review, integration into the task branch, integrated verification, tracker update, squash merge to `main`, and creation of the next task branch from updated `main`.

- [x] **Step 4: Verify synchronized wording**

```bash
rg -n "squash|subtask branch|exact tracker|updated main" AGENTS.md context/ai-workflow-rules.md docs/superpowers/specs/2026-07-22-local-worktree-layout-design.md context/progress-tracker.md
npx prettier --check AGENTS.md context/ai-workflow-rules.md docs/superpowers/specs/2026-07-22-local-worktree-layout-design.md context/progress-tracker.md docs/superpowers/plans/2026-07-22-squash-worktree-workflow.md
git diff --check
```

Expected: every workflow document describes the same hierarchy and all formatting checks pass.

- [x] **Step 5: Commit the documentation task**

```bash
git add AGENTS.md context/ai-workflow-rules.md context/progress-tracker.md docs/superpowers/specs/2026-07-22-local-worktree-layout-design.md docs/superpowers/plans/2026-07-22-squash-worktree-workflow.md
git commit -m "docs: define task squash-merge workflow"
```
