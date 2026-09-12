# History Order Log — Design

**Date:** 2026-09-11
**Status:** Approved design and written spec
**Surface:** Connected web/iPhone PWA only

## Goal

Turn completed and cancelled History cards into readable order logs. A Group
Owner or Manager can see who was included, each person's final food status,
personal subtotal, and exact captured items. An ordinary Member sees only the
orders they joined and only their own entry.

## Product decisions

- History uses an expandable-card layout rather than putting every item in the
  feed or requiring a detail page for the first useful information.
- A collapsed card stays compact and shows status, restaurant, group,
  completion date, and participant count.
- Expanding one card reveals its permitted person-level log without expanding
  other cards.
- Each person row shows their captured display name and one of:
  - item count plus personal food subtotal;
  - `Not eating` when they declined; or
  - `No food selected` when a cancelled order contains no captured selection.
- `View exact items` opens the existing order route in permanent read-only
  mode for terminal orders. It shows saved item names, quantities, notes,
  prices, and line subtotals.
- Every current Group Owner and Manager can view every historical order and
  every participant entry in that group, including orders they did not create
  or join.
- An ordinary Member sees only historical orders they joined and only their
  own person-level entry and exact items.
- Android is out of scope because its Orders screen is still fixture-backed;
  connecting the Android History journey is a separate task.

## Access boundary

History authorization uses the viewer's current group membership:

- `owner` and `manager`: list all terminal orders in the group and return the
  complete participant breakdown;
- `member`: list only terminal orders containing that user and return only the
  user's participant row and order lines;
- no active membership: return no group history;
- Platform Admin status alone does not grant member-facing History access.

The same rule applies to both `/orders` and `/orders/[orderId]`. The server
filters unauthorized participants and lines before rendering, so hidden data
is never sent to the browser.

The participant display name comes from `order_participants.display_name_snapshot`.
Item name, quantity, note, unit price, and line subtotal come from immutable
`order_lines` snapshots. Later profile or menu edits therefore do not rewrite
the log.

## Data flow

1. The Orders page passes the complete signed-in identity to the order-summary
   service instead of passing only a user ID.
2. The repository lists visible orders using active group roles: all group
   orders for Owners/Managers and participant-only orders for Members.
3. For terminal order IDs, the repository loads saved order lines in one
   batched query. It must not issue one query per History card.
4. The service groups lines by order and participant, calculates item counts
   and safe-integer personal subtotals, then removes other participant entries
   for ordinary Members.
5. The page renders each terminal summary as one accessible expandable card.
6. The existing detail service and page apply the same current-role rule and
   expose only the permitted exact lines in a read-only terminal view.

Active-order summary behavior remains unchanged.

## UI behavior

- Use a native keyboard-accessible disclosure control with an explicit
  accessible name such as `Show order log for KFC – Magsaysay`.
- Keep only the selected card open or closed; cards do not share expansion
  state.
- Preserve the approved member tokens: white cards, thin border, 16px radius,
  muted metadata, forest-green actions, and tabular price numerals.
- Person rows use captured names as the primary label. Item count/status sits
  below the name, and the subtotal aligns on the opposite edge.
- A zero subtotal is shown as `₱0.00` only when a selection/status exists;
  `No food selected` remains the primary truth for incomplete cancelled rows.
- Terminal detail pages show no food-picking, finish, or cancel controls.
- The existing empty-History message remains. A load failure uses a safe,
  retryable message and does not expose database or authorization details.
- Long participant lists remain within their expanded card and preserve normal
  page scrolling and dynamic text sizing.

## Error and integrity handling

- Reject unsafe subtotal arithmetic rather than displaying a rounded or
  overflowed amount.
- A participant with multiple saved lines receives one combined item count and
  subtotal.
- A declined participant has no exact item lines.
- A cancelled participant with saved lines keeps those lines in the log; a
  cancelled participant without saved lines shows `No food selected`.
- Missing terminal rows continue to map to the existing not-found behavior.
- Active orders never receive the new History disclosure payload.

## Verification

- Repository tests prove role-based order visibility and one batched line read
  for multiple terminal orders.
- Service tests prove full Owner/Manager breakdowns, self-only Member
  breakdowns, counts, safe totals, declined rows, and incomplete cancelled
  rows.
- Page tests prove collapsed metadata, accessible expansion, person rows,
  exact-item links, terminal read-only behavior, and absence of unauthorized
  names/items.
- Existing active-order tests must remain green.
- Run focused tests, workspace typecheck, lint, and the web production build.
- A signed-in browser walkthrough with real Owner, Manager, and Member
  accounts remains the final acceptance check and is reported separately from
  automated verification.

## Out of scope

- Android History data integration.
- Receipts, payments, repayment tracking, or Grab totals.
- Editing historical names, statuses, items, notes, or prices.
- Search, date filters, export, or pagination changes.
- Any automatic Grab cart, checkout, payment, or order placement.
