# History order log

## Implemented

- History cards keep the terminal order summary compact, then expand into an authorized participant log with names, response state, item count, and subtotal.
- Current Group Owners and Managers can inspect every Ordered or Cancelled order in their group, including exact immutable saved lines. They do not gain access to active orders they do not manage or join.
- Current Members see only terminal orders they joined and only their own response and saved lines. Users without active group membership see no group history.
- Declined participants show `Not eating`; cancelled participants without saved lines show `No food selected`.
- Saved lines for the history list load in one batch, and terminal details are permanently read-only.

## Verification

- `npm run test:unit` — 97 files and 583 tests passed.
- Focused history and order UI/service tests — 5 files and 70 tests passed.
- Focused Neon provider integration tests — 2 passed and 31 skipped; verified current Manager terminal visibility, removed-Member exclusion, and batched saved-line loading in an isolated temporary schema.
- `npm run typecheck` — passed after correcting the Home page to pass the full identity required by role-aware history authorization.
- `npm run lint` — no errors; one existing Android `react-hooks/exhaustive-deps` warning remains in `apps/mobile/src/features/access/admin-decision-panel.tsx`.
- `npm run build:web` — passed with the `/orders` and `/orders/[orderId]` routes compiled.
- Local unauthenticated browser smoke — `/orders` loaded and correctly showed Google sign-in in both the in-app browser and Chrome.

## Pending acceptance

- Both available local browser sessions were unauthenticated. Signed-in browser verification remains pending for the full Group Owner/Manager log, Member self-only log, no-membership state, exact read-only lines, literal cancelled statuses, and unchanged active-order access.
