# UI Context

## Current Web/PWA Direction

The October 5 supplied screenshots supersede earlier web/PWA visual references. See `docs/superpowers/specs/2026-10-05-web-pwa-reference-ui.md`. Use Session-First for Home and apply the Groups, History, Favorites, and Social-Session detail references to their matching routes. Use native system sans-serif typography, forest green actions, white surfaces, pale green selections, quiet borders, compact rounded cards, and Home/Sessions/Favorites/Groups root tabs. Android remains unchanged. At widths of 900px and above, use a centered canvas up to 1200px, sticky top navigation (including nested orders), card grids, and split Favorites/order/setup panels. Below 900px, retain the phone composition, bottom tabs, and setup footer.

Order setup uses three screens (Group, Delivery, Restaurant & voting) with inline Review and Start order on the third; the four reference milestone labels remain. Preserve all existing validation, delivery fields, voting/shortlist controls, and permission checks. Favorites filters, group sections, and terminal Participants/Details sections work. Unpictured web/admin/access screens retain their fields and behavior in the same visual style.

## Previous Direction (Web Superseded; Android Unchanged)

Option 1 is the approved V1 visual direction. Its corrected reference is `context/assets/ordah-please-option-1.png`. It uses an original `ordah please` identity with a bright light canvas, emerald actions, pale mint support surfaces, rounded cards, restrained shadows, clear food photography, and a friendly high-legibility type system. Grab is a usability reference only; its logo, exact layout, branded art, and promotional treatments must not be copied.

## Structural UI Rules

- Web and Android invitation screens preserve the invitation through Better Auth Google sign-in and do not expose email/password or public registration.
- Invitation screens show sign-in before Join group, state that joining does not add the person to an order, disable duplicate submission, and provide one safe retryable error without exposing provider details.
- The Groups screen lists every group the user belongs to and spells roles as Group Owner, Manager, and Member. Opening a group shows its owner and members; management actions appear only when the effective permissions allow them.
- A signed-in user with no memberships still sees restaurant discovery and account-owned Favorites, never sees invented active orders, and receives clear join-first empty states on Orders and Groups.
- Android is touch-first and native-feeling.
- The iPhone PWA provides equivalent ordering behavior and clear Home Screen installation guidance.
- Admin Imports accepts one CSV, XLS, or XLSX file up to 5MB through the file picker or drag-and-drop. Show drag feedback and reject unsupported selections. Excel uses the first worksheet with the same catalog columns; selecting a file previews it before explicit import confirmation.
- The desktop admin portal prioritizes dense menu comparison, validation errors, and audit information.
- History cards have a 16px gap between entries and show status, restaurant, group, completion date, and participant count before expansion. Expanding reveals only server-authorized participant rows, with item count and subtotal when food was saved, `Not eating` after a decline, and `No food selected` when a cancelled order has no saved food. Exact terminal details remain read-only.
- Limited mobile admin exposes Groups, Catalog, Access Requests, and Audit Log. Desktop additionally exposes Overview, Users and Permissions, Imports, and Refresh Queue.
- Every active-order view shows stage, deadline, participant status, and the no-response consequence.
- Every price display identifies itself as a food subtotal and excludes Grab fees, discounts, and promotions.
- Loading, empty, stale, unavailable, validation-error, and retry states are designed states, not afterthoughts.

## Accessibility Requirements

- All interactive controls have accessible names and visible focus states.
- Do not rely on color alone for status or error meaning.
- Support dynamic text sizing without clipping core actions.
- Touch targets are at least 44 by 44 logical pixels.
- Dialogs trap focus on web and restore focus on close.
- Use plain language for deadlines, automatic inclusion, and destructive actions.
- Use English for all application-authored copy and mock content.
- Preserve externally imported proper names verbatim so restaurant and menu identification stays accurate.

## V1 Visual Tokens and Libraries

- Light theme only for V1.
- Use the semantic colors, spacing, radii, and elevation rules in `design-structure.md`.
- Web/PWA uses native system sans-serif with tabular numerals; Android retains Nunito Sans.
- Use Lucide icons.
- The web browser tab icon uses the user-supplied artwork in `apps/web/app/icon.png`, preserving its original framing.
- Use React Native Paper as adapted Android primitives and shadcn/ui as adapted web/admin primitives.
- Treat the approved Option 1 active-order home screen as the representative member layout.
- Web/PWA Home shows active sessions, personal usuals, recent group orders, and retained restaurant discovery. Sessions switches between Active and Past; Favorites filters ranked combinations by restaurant while preserving exact branch labels. Groups owns Overview, History, and Members.
- Extend the same tokens to the iPhone PWA and use denser table/detail compositions in the desktop admin without changing the brand language.

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

## V1-16 Participant-first History and deletion controls

- Provide Save session to History on the participants step without requiring a restaurant or address. Logged sessions use their saved date in History while preserving a null completion timestamp.
- Current owners have an Edit or delete session link on session detail, including finished sessions. The editor uses the existing fields and cards; dates use Philippine time and food subtotals are recomputed server-side.
- Keep session and group deletion warnings explicit: describe who loses the record, what is removed, and that deletion cannot be undone. Cancel/Keep remains available before submitting deletion.
- Remove the redundant View participants link and use Ready to finish for legacy handoff records.
