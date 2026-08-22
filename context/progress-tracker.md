# Progress Tracker


## Current Phase

- Member PWA reference redesign and compact-density refinement implemented across member screens, including single-back nested pages and 84–85px restaurant menu rows. Evidence: 94 test files / 520 tests, full workspace typecheck, web production build, lint with one pre-existing unrelated mobile warning, and authenticated comparison captures.


## Journey Bundles


## Completed

- [x] Order setup and participants — merged to `main` 2026-08-22 (squash title "Order setup and participants"). Evidence and decisions in [`history/order-setup-participants.md`](history/order-setup-participants.md). Next order-sequence stage: Restaurant voting.

## Completion Evidence

- Web/PWA: focused tests, lint, typecheck, production build, browser verification.
- Native mobile: focused tests, lint, typecheck, Android emulator verification.
- Persistence/provider: migration and provider integration tests without exposing secrets.
- Mock-data UI does not count as connected journey completion.

## Out of Scope

Automatic Grab cart/checkout/payment/placement, in-app payment or repayment, unattended menu scraping, multi-platform collection, recommendation AI, dietary matching, chat, delivery tracking, promotions, fee estimation.
