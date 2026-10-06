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
- Permanent history containing branch, participants, selections, captured prices, subtotal, order manager, status, receipts, and timestamps. Current Group Owners and Managers can audit the full group log; current Members can review only terminal orders they joined and only their own response and saved lines.

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
8. The completed order is visible in permanent history as an expandable participant log, with full group audit access for current Group Owners and Managers and self-only access for current Members who participated.
9. Android push and iPhone PWA web push work for invited users.
10. The system remains inside the defined security boundaries and targeted free tiers during prototype use.

## V1-16 History and removal policy (2026-10-06)

The connected web/PWA saves selected participants to History immediately when the session is saved, with restaurant and food details optional and editable later. Manual completion does not require a restaurant. Current group Owners and Managers can correct all captured session details or permanently delete sessions in their assigned groups. Members retain scoped viewing; Platform Admin status alone does not grant session editing.

Platform Admins can permanently delete active or archived groups after a caution that all group sessions and history will also be removed. Account identities, favorites, and catalog records remain. Archived groups are omitted from active membership/profile summaries. The app no longer introduces a handoff completion stage; external ordering and payment remain manual. These rules supersede permanent immutable history and archive-only deletion descriptions above for the web/PWA.

## V1-18 Pre-added members (2026-10-06)

Platform Admins can create members with only a display name, before Google sign-in. They can assign those members to groups and include them in sessions immediately. After the person signs in normally, an admin may explicitly link the pre-added member to that signed-in account; leaving the records separate is supported. Linking combines group memberships and session history, preserves historical display-name snapshots and existing signed-in account data, and uses the signed-in account's current name and email. Conflicting participation in the same session or favorites at the same branch/rank blocks linking without changing either record. No automatic matching by name or email occurs.

## V1-21 Group managers and admin membership cards

Platform Admins open a group from Admin Groups to add people, remove non-owner memberships, appoint Managers, or return Managers to Member. Manager roles grant owner-equivalent session creation, active/terminal visibility, food-detail correction, completion/cancellation, history editing/deletion, and group rename within assigned groups. Ownership remains protected; there is no ownership transfer or platform-admin elevation. Member management, role changes, and invitation issuance/rotation are admin-only, including older access APIs. Ordinary member picking remains participant-scoped. No database migration is required.

## V1-22 Session receipt policy

Web/PWA sessions have an owner-controlled receipt switch, Group/Individual mode and selected submitters. Owner permission is implicit when enabled; Managers require explicit selection to submit. Multiple receipts contain one supported image or PDF, a positive PHP amount and an optional note. Group receipts are shared with participants; Individual receipts are self-only, while Owners/Managers audit all. Selected people manage their own submissions; owners manage all and can assign individual receipts to any current participant. Disabling prevents receipt writes while retaining reads. Mode changes apply only to new receipts, and removing a participant preserves owner/Manager audit records. Amounts remain separate from food subtotals. Receipt attachments are deleted with their session/group through a durable private-object cleanup queue.

The session total is an optional, positive PHP amount stored separately from calculated food subtotals and individual receipt amounts. Current group owners and managers can set or clear it even while receipts are disabled. Participants with session access can view it. Uploading, editing, or removing receipts never recalculates the session total. Receipt entry labels explicitly say “Receipt amount (PHP)”.
