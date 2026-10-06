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
- **History Viewer:** Keeps each terminal order compact by default, then expands to a participant log. Current Group Owners and Managers see every participant and may open the exact immutable saved lines; Members see only their own authorized row and lines. Cancelled rows say `Not eating` for declined participants and `No food selected` when no saved food exists.
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
- Show a layout-matched loading skeleton immediately during dynamic member and admin navigation. Announce it once to assistive technology and disable its pulse when reduced motion is requested.
- Keep terminal orders compact at first: load participant totals only when a person opens that order, and add older summaries ten at a time without replacing visible history.

## Approved Visual System

The October 5 screenshots are the current web/PWA source of truth, with the distributed screen mapping and three-screen setup specified in `docs/superpowers/specs/2026-10-05-web-pwa-reference-ui.md`. The August 22 PWA reference and older Option 1 image are historical web directions. Android keeps its existing shared tokens and implementation.

Web/PWA uses forest-green actions (`#367B45`), strong brand text (`#276B37`), pale green support (`#EEF7F0`), white surfaces, gray-green borders (`#DFE7E2`), near-black text (`#101810`), native system sans-serif typography, a centered 393–430px content canvas below 900px and a member canvas up to 1200px from 900px, 20px mobile margins, rounded compact cards, and four root tabs: Home, Sessions, Favorites, Groups. Home follows Session-First. Nested order screens omit root navigation; setup has its own fixed Back/Next/Start actions. Groups has Overview/History/Members; terminal orders have Participants/Details. Remaining screens retain their behavior and use this visual style.

The original shared/Android token system remains:

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
- **Previous member composition (Android/shared history):** Use a centered 393–430px mobile canvas, compact 18px side margins, restrained headings, quiet rounded cards, and a fixed four-tab bar with one floating new-order action. Nested pages use only the shell back button. Restaurant menu rows use 68px real food images and 84–85px rows so more items remain visible. Suppress the floating action on Group details and Restaurant details where it duplicates or covers page actions.
- **Brand protection:** Reproduce only the product owner's approved ordah please references. Do not reproduce Grab's logo, custom illustrations, or promotion treatments.

## Responsive Structure

- Web/PWA root tabs use bottom navigation below 900px and top navigation on desktop for Home, Sessions, Favorites, and Groups. Nested order screens use page actions and Back; other nested pages retain the tab bar. Android retains its existing navigation.
- Nested member routes use one circular shell back control while keeping the brand, notification, and profile controls in the same shell; page-local duplicate back links are not shown.
- Member pages switch at 900px to a centered desktop canvas up to 1200px with 32px margins and sticky top navigation. Home, Sessions, Groups, catalog, and restaurant menus use card grids; Favorites uses an introduction beside ranked restaurant cards. Order setup uses two participant columns, saved-address/details panels, and settings beside Review. Order details keep session information beside picking and participant content. Below 900px, retain the phone canvas and bottom tabs; nested orders keep their own mobile actions.
- Manager actions remain inside the active order rather than a separate global dashboard.
- Desktop admin uses persistent navigation and table/detail split views.
- Mobile admin exposes Groups, Catalog, Access Requests, and Audit Log.

## Admin reference styling — October 6, 2026

Admin now shares the approved web visual system through `apps/web/app/admin-reference-ui.css`: pale canvas, white rounded cards, green actions, compact headings, and rounded fields. Its sidebar remains separate from the member top navigation. The workspace centers up to 1440px, with a sticky 224px sidebar and sticky header on desktop. Existing limited mobile admin navigation remains at 720px and below. Metrics use four columns on desktop, two up to 1100px, and one on mobile; user details stack up to 1100px. Tables scroll within their cards, the group table has six columns, catalog editing uses split restaurant/branch panels, and portal dialogs scroll within the viewport. Catalog stays selected on nested edit routes. Existing data, permissions, actions, and import workflow remain unchanged.

## Member reference fidelity correction — October 6, 2026

Groups, History, Favorites, and active-session detail now follow the supplied desktop composite's page structures, adapted to mobile as explicitly requested. `member-reference-layouts.css` extends the prior phone and desktop styles. Group cards include real member initials/role, eligible start links, and the most recent ordered entry found in the first authorized history page; missing entries link to group history. Independent group/history reads run in parallel. History has date badges, thumbnails, month headings and counts of loaded rows, group/month filters, and authorized subtotals after lazy expansion. Favorites has By restaurant/All favorites modes, visible branch headings, ranked photo tiles and accessible bookmark removal. Active sessions have a desktop sidebar (horizontal mobile navigation), group-first identity, response progress, compact expandable participant rows for managers, and a subtotal beside participants (stacked on mobile). Non-managers' new summary totals only their own food lines. Existing picker, stage/deadline guidance, Finish/Cancel permissions, and terminal logs remain intact. Sample-only reminders, suggested groups, Create group, shared-order placement, and group-wide favorite ordering are not fabricated.

## Full-width browser shell — October 6, 2026

The user explicitly replaced the centered desktop shell with a full-width browser workspace. Member shells use the full viewport from 900px, with no shell outline/shadow and the existing 32px content inset. Admin fills the viewport at all widths, retaining its responsive sidebar. Member phone composition below 900px stays unchanged. Desktop floating order actions remain 32px from the window edge. This supersedes the earlier 1200px member and 1440px admin shell caps; intentionally constrained inner forms remain readable.

## Persistent desktop member sidebar — October 6, 2026

The user replaced desktop top navigation with an always-visible 224px left sidebar for Home, Sessions, Favorites, and Groups from 900px. It sits below the 84px header and scrolls independently if needed; main content reserves its width. The full-width workspace remains. Phone bottom tabs and nested-order navigation remain unchanged. This supersedes earlier desktop top-navigation guidance.

## Group layout, filters, and account photos — October 6, 2026

Group Overview places Recent orders, its date selector, and See all in one toolbar. History and Members wrappers span the desktop workspace; smaller desktop windows stack Overview columns. Group History has restaurant, status, and month filters over loaded authorized rows, with month headings and truthful no-match feedback. Phone History arranges the restaurant selector above status/date boxes. The roster reads account photo URLs through the existing membership query and uses initials only for missing or failed images. Cards align photo, name, and role; owner-only invite actions remain unchanged. Shared boxed native dropdown styling covers member and admin screens and admin fields in portal dialogs, preserving keyboard/mobile selection.
