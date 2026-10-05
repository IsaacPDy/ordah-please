# Progress Tracker


## Current Phase

- Food confirmation picking and Finish-order-now early completion implemented. Both golden paths still need a browser walkthrough with real accounts. Next order-sequence stage: Restaurant voting.


## Journey Bundles


## In Design


- [ ] History order log — Implementation and automated verification complete; signed-in Owner, Manager, and Member browser acceptance pending. Evidence in [`history/history-order-log.md`](history/history-order-log.md). See the [design spec](../docs/superpowers/specs/2026-09-11-history-order-log-design.md) and [implementation plan](../docs/superpowers/plans/2026-09-11-history-order-log.md).


## Completed

- [x] V1-10 Web/PWA reference UI redesign — implemented 2026-10-05. Session-First Home, shared visual style, Sessions/History, Groups, Favorites, order details, and three-screen setup. Unit tests, web typecheck, scoped lint, build, and connected member browser checks passed; localhost remains running. Desktop member sizing is implemented from 900px, with card grids, top navigation, and split setup/detail panels; desktop sample-preview checks passed. Signed-in desktop and production acceptance remain unverified. Evidence and acceptance limits in [`history/v1-10.md`](history/v1-10.md).

- [x] Admin CSV and Excel drag-and-drop imports — implemented 2026-10-05. CSV, XLS, and XLSX selection/drop validation, first-worksheet Excel parsing, and existing explicit import confirmation. Eighteen focused tests, scoped lint, web typecheck, and an isolated Chrome interaction/layout pass succeeded. Evidence in [`history/admin-import-dropzone.md`](history/admin-import-dropzone.md).

- [x] History card spacing — added a 16px gap between History entries on 2026-10-02. Six focused History tests passed; a browser CSS fixture verified the gap at 393px, 430px, and 1280px widths without horizontal overflow. Evidence in [`history/history-card-spacing.md`](history/history-card-spacing.md).
- [x] V1-09 Faster page data loading — deployed and verified 2026-10-01: Singapore functions, shared connections, read-only unchanged identities, and joined session/favorite reads. Signed-in tab data loaded in 369–579 ms versus the earlier 2,810–5,848 ms; full reloads took 433–772 ms. All 625 unit tests and 44 isolated development-Neon integration tests passed, along with typecheck, lint, and web build. Evidence and measurement/role boundaries are in [`history/v1-09.md`](history/v1-09.md).
- [x] V1-08 Progressive web performance — deployed to production 2026-09-13 and prepared for `main` as squash commit `Performance update`. Core-route shell medians are 334–344 ms, replacing the old 5.9–8.4-second wait before meaningful feedback. Evidence and the remaining multi-account acceptance boundary are in [`history/v1-08.md`](history/v1-08.md).
- [x] Finish order early — merged to `main` 2026-08-23 (squash title "Finish order early"). Evidence and decisions in [`history/finish-order-early.md`](history/finish-order-early.md). Next order-sequence stage: Restaurant voting.
- [x] Food confirmation picking — merged to `main` 2026-08-23 (squash title "Food confirmation picking"). Evidence and decisions in [`history/food-confirmation-picking.md`](history/food-confirmation-picking.md). Next order-sequence stage: Finish order early, then Restaurant voting, then handoff/completion and manager resolution.
- [x] Order setup and participants — merged to `main` 2026-08-22 (squash title "Order setup and participants"). Evidence and decisions in [`history/order-setup-participants.md`](history/order-setup-participants.md). Next order-sequence stage: Restaurant voting.

## Completion Evidence

- Web/PWA: focused tests, lint, typecheck, production build, browser verification.
- Native mobile: focused tests, lint, typecheck, Android emulator verification.
- Persistence/provider: migration and provider integration tests without exposing secrets.
- Mock-data UI does not count as connected journey completion.

## Out of Scope

Automatic Grab cart/checkout/payment/placement, in-app payment or repayment, unattended menu scraping, multi-platform collection, recommendation AI, dietary matching, chat, delivery tracking, promotions, fee estimation.
