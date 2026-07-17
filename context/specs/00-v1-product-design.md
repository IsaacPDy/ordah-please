# ordah please — V1 Product Design

## Goal

Build a private food-order coordination system for fewer than 30 friends that completes the real-world loop from reviewed restaurant import through manual Grab checkout and permanent order history.

The final product display name is `ordah please`, the technical slug is `ordah-please`, and the Android application ID and namespace are `ordahplease.app`.

## Approved Product Decisions

- Native Android plus iPhone PWA; no public store release.
- One private group per user and a private-deployment global restaurant catalog.
- Google sign-in and invitation-only access.
- Platform admin, group owner, organizer, and member roles.
- Admin-reviewed external Computer Use imports; no unattended scraping.
- Weekly supervised refresh of every imported restaurant, with explicit admin pause, stale-data fallback, and risk-based publication.
- Three member-ranked complete combinations per restaurant.
- Organizer-selected participants and organizer-set deadlines.
- One group default delivery address with an organizer override captured on each order.
- Optional restaurant vote with shortlist or global catalog.
- At least 50% threshold; organizer and initial vote count; initial restaurant is fallback and tie winner.
- Two stages: restaurant choice followed by food confirmation.
- Rank 1 automatic inclusion for non-responders with valid favorites.
- Organizer resolution for missing or invalid selections.
- Food subtotal only, consolidated items, per-member detail, copyable text, and outgoing Grab link.
- Manual Ordered or Cancelled result, optional receipt, permanent history.
- Organizer-selected food becomes a proposed favorite only after member approval.
- All application-authored copy, documentation, notifications, placeholders, and mock data use English only.
- Externally imported proper names remain verbatim so the app can identify the exact restaurant and menu item in Grab.

## Approved Visual Direction

- Use the selected Option 1 direction: bright, clean, food-first, friendly, and highly scannable.
- Keep the identity original to `ordah please`; do not copy Grab's logo, branded illustrations, promotion art, or exact layouts.
- Use a light canvas, emerald primary actions, pale mint support surfaces, charcoal text, rounded cards, restrained shadows, and appetizing food photography.
- The active order card is the first major element and shows the stage, deadline, response count, primary action, and no-response consequence.
- Use English-only fictional names and labels in prototypes. Imported real-world names remain unchanged.

## Approved Architecture

Use Expo Android, Next.js PWA/admin/API, Neon PostgreSQL, Clerk identity, Cloudflare R2, OneSignal, Upstash QStash, Vercel, Expo EAS, and shared TypeScript packages. Product roles live in Neon. All privileged access passes through the authenticated Vercel API.

## Data Flow

1. Clerk verifies identity.
2. The API maps identity and roles from Neon.
3. The domain package validates the requested transition.
4. Neon transactions persist structured state.
5. R2 holds private file bytes.
6. QStash invokes scheduled API work.
7. OneSignal delivers notification events.
8. Clients refresh authoritative state from the API.

## Error and Recovery Design

- Preserve last published menus after collection or import failure.
- Keep invalid imports in draft with row-level errors.
- Require review for suspicious changes.
- Make scheduled handlers retry-safe and idempotent.
- Log notification failure without corrupting order state.
- Require organizer resolution before handoff when food is missing or unavailable.
- Keep the handoff readable and copyable if Grab cannot be opened.
- Never infer successful purchase from opening Grab.

## Verification Strategy

- Unit tests prove domain thresholds, ties, ranks, defaults, totals, state transitions, and permission matrices.
- Integration tests prove authenticated APIs, transactions, signed uploads, scheduled retries, and notification event creation.
- End-to-end tests prove the complete loop on Android and iPhone PWA.
- Admin tests prove import validation, publication, refresh fallback, role approval, and limited mobile actions.
