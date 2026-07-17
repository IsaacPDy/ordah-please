# Design Structure

## Product Surfaces

### Android Member Application

- Invitation and Google sign-in
- Global catalog browsing
- Restaurant detail and menu
- Favorite combination editor and ranking
- Active order voting and confirmation
- Consolidated handoff for organizers
- Order history
- Limited mobile admin actions

### iPhone PWA

- Mirrors member and organizer capabilities required for the full order loop.
- Provides installation and notification-permission guidance.
- Uses browser-safe file, share, and outgoing-link behavior.

### Web Admin Portal

- Admin-access request review
- Restaurant import upload and validation
- Import draft comparison and publication
- Weekly refresh queue and failure review
- Restaurant pause and catalog maintenance
- User and audit visibility required for support

## Core Components

- **Catalog Browser:** Finds published restaurants and exact branches.
- **Menu Viewer:** Shows versioned items, modifiers, availability, and captured prices.
- **Favorite Builder:** Saves complete combinations and enforces three ranks.
- **Order Creator:** Selects participants, restaurant-choice mode, fallback, and deadlines.
- **Restaurant Vote:** Applies the 50% threshold and organizer fallback/tie rules.
- **Food Confirmation:** Applies default Rank 1, member changes, opt-out, and organizer resolution.
- **Handoff Summary:** Consolidates identical lines while preserving member ownership.
- **History Viewer:** Shows immutable captured order details and optional receipt.
- **Import Reviewer:** Compares collected data with the published menu and classifies risk.
- **Notification Center:** Mirrors push events inside the application.

## Interaction Principles

- Show the current order stage, deadline, and consequence of no response on every active-order screen.
- Distinguish preselection from confirmed change, while clearly stating that Rank 1 is automatically included at deadline.
- Never present the food subtotal as Grab's final checkout price.
- Keep the organizer's unresolved-action list visible before handoff.
- Show stale-menu and failed-refresh warnings without erasing usable historical data.
- Make destructive catalog publication and role approval explicit and auditable.
- Use English for all application-authored labels, messages, notifications, placeholders, documentation, and mock data.
- Preserve imported proper names exactly as supplied by the reviewed catalog.

## Approved Visual System

The selected Option 1 direction is the V1 visual source of truth. The corrected reference is stored at `context/assets/ordah-please-option-1.png`.

- **Personality:** Bright, friendly, food-first, calm, and easy to scan.
- **Theme:** Light theme for V1. Dark theme is deliberately out of scope until the core flow is proven.
- **Primary:** Original emerald `#0AAE5B` for primary actions, active navigation, and progress.
- **Primary strong:** `#078847` for pressed and high-emphasis states.
- **Support surface:** Pale mint `#EFFAF3` for active-order and informational cards.
- **Canvas and surface:** `#F8FBF9` canvas and `#FFFFFF` cards.
- **Text:** `#172019` primary and `#667069` secondary.
- **Border:** `#DDE8E1`; **warning:** `#B86B00`; **error:** `#B42318`.
- **Typography:** Nunito Sans for friendly, readable application copy. Use tabular numerals for prices, times, and totals.
- **Spacing:** 4-point base scale: 4, 8, 12, 16, 24, 32, and 40.
- **Radii:** 8 for compact controls, 12 for fields, 16 for standard cards, 24 for major active-order cards, and full pills only for tags.
- **Elevation:** Thin borders by default; use one restrained shadow level for raised cards and persistent actions.
- **Icons:** Lucide icons on Android and web for a consistent outlined style. Icons support text; they do not replace unclear labels.
- **Components:** React Native Paper primitives adapted to shared tokens on Android; shadcn/ui primitives adapted to the same tokens on web and admin.
- **Photography:** Real food imagery with consistent rectangular crops. Never use copied promotional art or restaurant logos as decorative UI.
- **Brand protection:** Do not reproduce Grab's logo, custom illustrations, promotion treatments, or exact screen composition.

## Responsive Structure

- Member mobile uses bottom navigation for Home, Orders, Favorites, and Team.
- Organizer actions remain inside the active order rather than a separate global dashboard.
- Desktop admin uses persistent navigation and table/detail split views.
- Mobile admin exposes only approvals, refresh failures, and restaurant pause actions.
