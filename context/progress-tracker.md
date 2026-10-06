# Progress Tracker


## Current Phase

- Food confirmation picking and Finish-order-now early completion implemented. Both golden paths still need a browser walkthrough with real accounts. Next order-sequence stage: Restaurant voting.


## Journey Bundles


## In Design





- [ ] History order log — Implementation and automated verification complete; signed-in Owner, Manager, and Member browser acceptance pending. Evidence in [`history/history-order-log.md`](history/history-order-log.md). See the [design spec](../docs/superpowers/specs/2026-09-11-history-order-log-design.md) and [implementation plan](../docs/superpowers/plans/2026-09-11-history-order-log.md).


## Completed

- [x] V1-19 Mobile web icon — implemented 2026-10-06. iPhone Home Screen artwork now matches the browser tab icon. Exact asset comparison passed; the live browser icon already matched the supplied image before this change. Evidence in [`history/v1-19.md`](history/v1-19.md).

- [x] V1-18 Pre-added members and optional account linking — implemented 2026-10-06. Admins can create named members before first login, use them in groups and sessions, and explicitly combine them with a signed-in account. Normal login remains independent. Focused tests (61), isolated development database linking tests (3), web typecheck, scoped lint, production build, and signed-in create/link browser checks passed. Evidence in [`history/v1-18.md`](history/v1-18.md). No migration required; production unverified.

- [x] V1-17 Browser tab icon — implemented 2026-10-06. Supplied image replaces the web browser icon, preserving its original framing. Local browser metadata and exact served-file comparison passed. Evidence in [`history/v1-17.md`](history/v1-17.md). Production unverified.

- [x] V1-16 Editable session history and permanent group deletion — implemented 2026-10-06. Participant-first History logs, restaurant-free manual completion, owner editing/deletion, permanent admin group deletion with caution, archived-profile filtering, and removal of handoff/View participants. Full unit suite (663), isolated development database integration tests (41), typecheck, scoped lint, production build, and signed-in control checks passed. Development migration applied; production unverified. Evidence in [`history/v1-16.md`](history/v1-16.md).

- [x] V1-15 Group layouts, filters, and profile photos — implemented 2026-10-06. Inline Recent orders/date toolbar, full-width group History and Members, restaurant/status/date filtering, account profile photos with fallback, and boxed member/admin dropdown controls. Twenty affected tests, web typecheck, scoped lint, build, and signed-in responsive browser checks passed. Evidence in [`history/v1-15.md`](history/v1-15.md). Production unverified.

- [x] V1-14 Persistent desktop member sidebar — implemented 2026-10-06. Desktop member navigation uses a fixed left sidebar from 900px while retaining the full-width workspace and phone bottom tabs. Signed-in responsive browser checks and CSS formatting passed; build evidence in [`history/v1-14.md`](history/v1-14.md). Production unverified.

- [x] V1-13 Full-width browser shell — implemented 2026-10-06. Desktop member and admin shells fill the browser, without outer box borders; floating desktop actions align to the window edge. Phone composition retained. Signed-in member/admin layout checks, formatting, build, and whitespace checks passed. Production unverified. Evidence in [`history/v1-13.md`](history/v1-13.md).

- [x] V1-12 Member reference layout fidelity — implemented 2026-10-06. Rich membership cards, monthly History rows, restaurant/All favorites layouts, and social-session sidebar, participant disclosures, progress, and subtotal panels on desktop and mobile. 98 affected tests, web typecheck, scoped lint, build, and signed-in local browser checks passed. Production and separate-role acceptance remain unverified. Evidence in [`history/v1-12.md`](history/v1-12.md).

- [x] V1-11 Admin reference UI redesign — implemented 2026-10-06. Matching cards, fields, actions, sidebar, tables, catalog editor, and dialogs across admin screens. Affected tests (80), web typecheck, scoped lint, build, and an isolated responsive actual-component preview passed. Signed-in admin and production acceptance remain unverified. Evidence in [`history/v1-11.md`](history/v1-11.md).

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
