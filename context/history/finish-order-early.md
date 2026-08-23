# Finish order early

Subtasks:

- Domain: `food_confirmation → ordered` added to `allowedTargets` (`packages/domain/src/orders/state-machine.ts`) — the natural deadline still lands on `ready_for_handoff`; only the explicit manager finish jumps to `ordered`
- Service: `collectRankOneDefaults` extracted from `advanceFoodDeadline` (both paths now share one rank-1 expansion implementation) and the new `finishOrder` use case (`apps/web/src/features/orders/orders-service.ts`): order manager or group owner only, food-picks stage only with a pinned menu version, rank-1 defaults ordered for still-pending participants, no-favorite participants left empty without blocking, straight to `ordered` with `completedAt`, audited as `order.ordered` with `{ finishedEarly: true }`
- API: `POST /api/orders/[orderId]/finish` via `createFinishOrderHandler` (trusted-mutation check, UUID order-id param, empty JSON body) wired through `ordersRuntime.finishOrder`
- Web UI: `FinishOrderButton` client island (`window.confirm` clone of `CancelOrderButton`, positive `primary-action` styling, redirects to /orders on success) rendered on the living order page for managers while the order is in food picks

## Session Notes

- Implemented on `task/finish-order-early` off post-picking `main` (squash `2727bdc`). Product decisions from 2026-08-23: food-picks stage only (no skipping restaurant voting); no-pick participants do not block completion — a deliberate deviation from the natural-deadline behavior, which keeps unresolved orders in `food_confirmation`; straight to History, skipping the handoff screen.
- Operational note: the `server` vitest project resolves `@ordah-please/domain` through the package's built `dist`, so domain changes must be rebuilt (`npm run build --workspace @ordah-please/domain`) before apps/web tests see them — this surfaced when the new transition "didn't exist" in service tests.
- Verification: `npm run test:unit` 96 files / 570 tests pass; provider tests pass except the one pre-existing `main` failure (`schema.provider.integration.test.ts` group_invite_links constraint assertion, documented in both earlier histories); `npm run lint` green except the known mobile `admin-decision-panel.tsx` warning; `npm run typecheck` clean; `npm run build:web` green with `/api/orders/[orderId]/finish` listed. Unauthenticated smoke on the dev server: `POST /api/orders/:id/finish` returns 401 `UNAUTHENTICATED`.
- Browser verification of the golden path (manager taps Finish order now → order lands in History with defaults materialized) is pending, to be walked through together with the food-picking golden path postponed on 2026-08-23.
