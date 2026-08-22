# Design Structure

## Product Surfaces

### Android Member Application

- Invitation and Better Auth Google sign-in with a return to the same invitation
- Global catalog browsing
- Restaurant detail and menu
- Favorite combination editor and ranking
- Active order voting and confirmation
- Consolidated handoff for Managers and Group Owners
- Order history
- Limited mobile admin actions

### iPhone PWA

- Mirrors Member, Manager, and Group Owner capabilities required for the full order loop.
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

- **Invitation Onboarding:** Preserves one private invitation through Better Auth Google sign-in, explains that group membership is separate from order participation, and accepts only after authentication.
- **Groups Access:** Lists multiple memberships, shows exact Group Owner, Manager, and Member labels, and reveals actions from the user's effective role permissions and account-wide overrides.
- **No-membership State:** Keeps account-owned Home discovery and Favorites available, removes invented active-order content, and replaces Orders and Groups with truthful join-first empty states.
- **Catalog Browser:** Finds published restaurants and exact branches.
- **Menu Viewer:** Shows versioned items, modifiers, availability, and captured prices.
- **Favorite Builder:** Saves complete combinations and enforces three ranks.
- **Order Creator:** Selects participants, restaurant-choice mode, fallback, and deadlines.
- **Restaurant Vote:** Applies the 50% threshold and initial-restaurant fallback/tie rules.
- **Food Confirmation:** Applies default Rank 1, member changes, opt-out, and Manager resolution.
- **Handoff Summary:** Consolidates identical lines while preserving member ownership.
- **History Viewer:** Shows immutable captured order details and optional receipt.
- **Import Reviewer:** Compares collected data with the published menu and classifies risk.
- **Notification Center:** Mirrors push events inside the application.

## Interaction Principles

- Keep authentication inside the invitation flow in V1: explain why sign-in is required, preserve the invitation across Google OAuth, and show a safe retry or sign-out action when the session fails.
- Show the current order stage, deadline, and consequence of no response on every active-order screen.
- Distinguish preselection from confirmed change, while clearly stating that Rank 1 is automatically included at deadline.
- Never present the food subtotal as Grab's final checkout price.
- Keep the Manager's unresolved-action list visible before handoff.
- Show stale-menu and failed-refresh warnings without erasing usable historical data.
- Make destructive catalog publication and role approval explicit and auditable.
- Keep admin creation forms in centered modals. If a form has changed, backdrop clicks keep it open with a short wobble, while the X asks before discarding the entered values.
- Use English for all application-authored labels, messages, notifications, placeholders, documentation, and mock data.
- Preserve imported proper names exactly as supplied by the reviewed catalog.

## Approved Visual System

The August 22 member-screen reference set is the current PWA visual source of truth. Its implementation contract is stored at `docs/superpowers/specs/2026-08-22-member-pwa-reference-redesign.md`; the older Option 1 image remains historical direction at `context/assets/ordah-please-option-1.png`.

- **Personality:** Bright, friendly, food-first, calm, and easy to scan.
- **Theme:** Light theme for V1. Dark theme is deliberately out of scope until the core flow is proven.
- **Primary:** Muted forest green `#55945B` for primary actions, progress, avatars, and persistent actions.
- **Primary strong:** `#477C4D` for brand text, pressed states, and accessible high-emphasis text.
- **Support surface:** Pale green `#F0FAF2` for active-order and selected-navigation surfaces.
- **Canvas and surface:** `#F4F6F4` outer canvas and `#FFFFFF` member/card surfaces.
- **Text:** `#182019` primary and `#717871` secondary.
- **Border:** `#DCE5DE`; **warning:** `#B86B00`; **error:** `#B42318`.
- **Typography:** Nunito Sans for friendly, readable application copy. Use tabular numerals for prices, times, and totals.
- **Spacing:** 4-point base scale: 4, 8, 12, 16, 24, 32, and 40.
- **Radii:** 8 for compact controls, 12 for fields, 16 for standard cards, 24 for major active-order cards, and full pills only for tags.
- **Elevation:** Thin borders by default; use one restrained shadow level for raised cards and persistent actions.
- **Icons:** Lucide icons on Android and web for a consistent outlined style. Icons support text; they do not replace unclear labels.
- **Components:** React Native Paper primitives adapted to shared tokens on Android; shadcn/ui primitives adapted to the same tokens on web and admin.
- **Photography:** Real food imagery with consistent rectangular crops. Never use copied promotional art or restaurant logos as decorative UI.
- **Member composition:** Use a centered 393–430px mobile canvas, compact 18px side margins, restrained headings, quiet rounded cards, and a fixed four-tab bar with one floating new-order action. Nested pages use only the shell back button. Restaurant menu rows use 68px real food images and 84–85px rows so more items remain visible. Suppress the floating action on Group details and Restaurant details where it duplicates or covers page actions.
- **Brand protection:** Reproduce only the product owner's approved ordah please references. Do not reproduce Grab's logo, custom illustrations, or promotion treatments.

## Responsive Structure

- Member mobile uses bottom navigation for Home, Orders, Favorites, and Groups.
- Nested member routes use one circular shell back control while keeping the brand, notification, and profile controls in the same shell; page-local duplicate back links are not shown.
- Member pages remain centered and phone-like on wide screens instead of stretching their content across the desktop.
- Manager actions remain inside the active order rather than a separate global dashboard.
- Desktop admin uses persistent navigation and table/detail split views.
- Mobile admin exposes Groups, Catalog, Access Requests, and Audit Log.
