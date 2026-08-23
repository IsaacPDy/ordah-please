# Progress Tracker


## Current Phase

- Food confirmation picking and Finish-order-now early completion implemented. Both golden paths still need a browser walkthrough with real accounts. Next order-sequence stage: Restaurant voting.


## Journey Bundles


## Completed

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
