# History card spacing

Completed 2026-10-02.

The History list previously had no layout gap, leaving adjacent card borders touching. Added a grid layout with `gap: var(--space-4)` (16px) to `.history-list` in `apps/web/app/globals.css`. This also separates the Load more control from the last card and keeps spacing when cards expand or additional entries load.

Updated the History spacing rule in `context/ui-context.md`.

## Verification

- Focused existing tests: `npx vitest run 'apps/web/app/(member)/orders/order-history.test.tsx' --config vitest.config.ts` — 1 file, 6 tests passed.
- Local Chromium fixture using the application's actual stylesheet and representative History markup: measured 16px between adjacent cards at 393px, 430px, and 1280px viewport widths; no horizontal overflow.
- `git diff --check` passed.

The CSS fixture checks layout only. Signed-in application acceptance and production deployment were not performed for this adjustment.
