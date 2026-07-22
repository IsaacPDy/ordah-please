# ordah please

## Product Identity

- **Display name:** `ordah please`
- **Technical project slug:** `ordah-please`
- **Android application ID and namespace:** `ordahplease.app`
- **Current workspace folder:** `Order App`

## Overview

ordah please is a private, invitation-only food-order planning app for fewer than 30 friends. It keeps a reviewed restaurant catalog, lets each member save up to three ranked order combinations per restaurant branch, coordinates restaurant voting and food confirmation, and compiles the final selections for an organizer to enter manually in Grab. It does not place or pay for orders automatically.

## Goals

1. Let invited users sign in with Google and participate in one private group.
2. Let admins maintain a trusted global catalog inside the private deployment.
3. Let members save and rank three complete food combinations per restaurant branch.
4. Let organizers run a two-stage restaurant-selection and food-confirmation process with deadlines.
5. Produce a consolidated, copyable Grab handoff with a per-member breakdown and food subtotal.
6. Preserve complete order history and optional receipt evidence.
7. Keep prototype infrastructure at approximately USD 0 per month within free-tier limits.

## Roles

- **Platform admin:** Maintains the global catalog, reviews imports and refreshes, handles admin-access requests, and performs limited mobile admin actions.
- **Group owner:** Manages group membership and promotes or removes organizers.
- **Organizer:** Creates and manages group orders and completes the Grab handoff.
- **Member:** Manages personal favorites, votes, confirms food, and views orders in which they participate.

The first platform admin is assigned manually. A group owner may request platform-admin access; one existing platform admin can approve or reject the request.

## Core User Flow

1. A user opens an invitation link and signs in with Google.
2. The user joins the single private group but is not automatically included in any order.
3. Platform admins populate the global catalog using reviewed JSON or CSV collected externally with Codex Computer Use.
4. A member browses a restaurant and saves up to three ranked, fully configured order combinations.
5. A group owner or organizer starts an order, selects the participating members, and confirms the group's default delivery address or overrides it for this order.
6. The organizer chooses an initial fallback restaurant, sets both deadlines, and either disables voting, provides a shortlist, or permits choices from the global catalog.
7. Selected participants vote. A restaurant wins with at least 50% of selected participants; the organizer and organizer's initial vote count. The initial restaurant wins if no alternative reaches the threshold or if the result is tied.
8. After restaurant resolution, selected members confirm food. Rank 1 is included automatically unless changed or declined.
9. Members without a valid saved combination select a new one. If they miss the deadline, the organizer chooses for them.
10. The app consolidates the selections, shows the food subtotal and member breakdown, produces copyable text, and opens the restaurant branch in Grab.
11. The organizer manually enters and purchases the order in Grab.
12. The organizer returns and marks the order Ordered or Cancelled, optionally attaching a receipt screenshot.
13. The completed order is retained in history. Organizer-chosen food is offered to the affected member as a possible favorite after the order.

## Features

### Identity and Access

- Google sign-in through Clerk.
- Private invitation links.
- One group per user.
- Group owner, organizer, member, and platform-admin permissions stored in Neon.
- Admin-access request and approval workflow.

### Restaurant Catalog

- Private-deployment global restaurant and branch catalog.
- Admin-reviewed JSON or CSV imports.
- Menu items, variants, modifiers, prices, availability, and cached thumbnails.
- Weekly supervised refresh reminders.
- Every imported restaurant remains in the weekly refresh queue; V1 does not skip restaurants because they are old or rarely used.
- Risk-based refresh publishing: ordinary price and availability changes may apply automatically; suspicious changes, removals, or major structural changes require admin review.
- Old data remains available when refresh collection or import fails.

### Favorites

- Three member-controlled ranked combinations per restaurant branch.
- Multiple items, quantities, variants, modifiers, and notes per combination.
- Fourth combination requires replacing an existing rank.
- Unavailable combinations require replacement during an active order.

### Group Ordering

- Organizer-selected participants per order.
- One saved group delivery address with an organizer override on each order.
- Optional restaurant voting with shortlist or global-catalog choices.
- Organizer-defined voting and food deadlines.
- Push notifications and in-app notification history.
- Automatic Rank 1 inclusion with member opt-out or change.
- Consolidated item totals and per-member detail.

### Completion and History

- Manual Ordered or Cancelled confirmation.
- Optional receipt screenshot.
- Permanent history containing branch, participants, selections, captured prices, subtotal, organizer, status, and timestamps.

## Scope

### V1 In Scope

- Private deployment for fewer than 30 invited friends.
- Native Android app distributed privately as an APK.
- Installable iPhone PWA and responsive web admin portal.
- One private group per user.
- One global catalog visible to accepted users of this deployment.
- External Codex Computer Use collection followed by admin-reviewed import.
- Google sign-in, push notifications, deadlines, voting, favorites, handoff, receipts, and history.

### V1 Out of Scope

- Public registration, public API, App Store, or Play Store release.
- Automatic Grab cart creation, checkout, payment, or order submission.
- In-app collection or settlement of money.
- Payment is made by the organizer in Grab and any repayment happens outside ordah please.
- Public or commercial redistribution of Grab data.
- Unattended backend scraping or bypassing Grab access controls.
- Multiple groups per user.
- Restaurant recommendations based on dietary profiles or AI.
- Group chat, delivery tracking, promotions, service fees, and delivery-fee estimation.

### Product Language

- All application-authored interface copy, documentation, placeholders, notifications, and mock data use English only.
- Do not introduce Tagalog words as decorative brand language or sample content.
- Preserve externally imported restaurant, branch, menu-item, and modifier names verbatim, even when a proper name is not English. Exact source names are required for an accurate Grab handoff.

## Success Criteria

1. An admin can import and publish at least one reviewed restaurant and menu.
2. Invited friends can sign in, join the group, and maintain three ranked combinations.
3. An organizer can select participants and complete both ordering stages.
4. Voting resolves according to the approved threshold, fallback, and tie rules.
5. Non-responders with valid favorites receive Rank 1; other unresolved members can be handled by the organizer.
6. The app compiles a correct order, food subtotal, member breakdown, and Grab handoff.
7. The organizer can record Ordered or Cancelled and optionally attach a receipt.
8. The completed order is visible in permanent history.
9. Android push and iPhone PWA web push work for invited users.
10. The system remains inside the defined security boundaries and targeted free tiers during prototype use.
