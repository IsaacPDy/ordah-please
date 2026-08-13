# ordah please

## Product Identity

- **Display name:** `ordah please`
- **Technical project slug:** `ordah-please`
- **Android application ID and namespace:** `ordahplease.app`
- **Current workspace folder:** `Order App`
conti
### Completion and History

- Manual Ordered or Cancelled confirmation.
- Optional receipt screenshot.
- Permanent history containing branch, participants, selections, captured prices, subtotal, order manager, status, receipts, and timestamps.

## Scope

### V1 In Scope

- Private deployment for fewer than 30 friends using Google accounts.
- Native Android app distributed privately as an APK.
- Installable iPhone PWA and responsive web admin portal.
- Multiple private groups per user with a different role in each group.
- One global catalog visible to accepted users of this deployment.
- External Codex Computer Use collection followed by admin-reviewed import.
- Google sign-in, push notifications, deadlines, voting, favorites, handoff, receipts, and history.

### V1 Out of Scope

- Public registration, public API, App Store, or Play Store release.
- Automatic Grab cart creation, checkout, payment, or order submission.
- In-app collection or settlement of money.
- Payment is made by the Manager or Group Owner in Grab, and any repayment happens outside ordah please.
- Public or commercial redistribution of Grab data.
- Unattended backend scraping or bypassing Grab access controls.
- Restaurant recommendations based on dietary profiles or AI.
- Group chat, delivery tracking, promotions, service fees, and delivery-fee estimation.

### Product Language

- All application-authored interface copy, documentation, placeholders, notifications, and mock data use English only.
- Do not introduce Tagalog words as decorative brand language or sample content.
- Preserve externally imported restaurant, branch, menu-item, and modifier names verbatim, even when a proper name is not English. Exact source names are required for an accurate Grab handoff.

## Success Criteria

1. An admin can import and publish at least one reviewed restaurant and menu.
2. Google users can browse restaurants, maintain ranked combinations, and join multiple groups through assignment or invitation.
3. A Manager or Group Owner can select participants and complete both ordering stages.
4. Voting resolves according to the approved threshold, fallback, and tie rules.
5. Non-responders with valid favorites receive Rank 1; other unresolved members can be handled by a Manager or Group Owner.
6. The app compiles a correct order, food subtotal, member breakdown, and Grab handoff.
7. A Manager or Group Owner can record Ordered or Cancelled and attach a receipt; enabled members can add their own receipts.
8. The completed order is visible in permanent history.
9. Android push and iPhone PWA web push work for invited users.
10. The system remains inside the defined security boundaries and targeted free tiers during prototype use.
