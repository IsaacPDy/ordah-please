# Group Details, Creation, and Persistent Invites Design

## Goal

Make the multi-group foundation visible and usable on the apps. Today the multi-group data model and identity boundary are correct, but the member app only renders raw membership IDs and the admin has no way to create a group. This bundle adds the read path that surfaces a real group with its owner and roster, the write path that lets a Platform Admin create a group, and a small set of working owner actions: rename the group and rotate its invite link.

It also changes the invitation model from expiring single-use tokens to one persistent, multi-use join link per group, because the user-approved invitation UX is "a link visible on the group that I can copy and send to anyone."

## Why This Bundle Comes Now

Multi-group foundation (spec `04-multi-group-foundation-design.md`) shipped the database and identity layer but explicitly deferred group names, member rosters, group creation, leaving, rejoining, and archival. The app renders a stripped-down Groups screen showing only membership IDs and roles, which makes the prior bundle feel unfinished to the user.

The tracker's planned next step is the Effective permissions foundation bundle, followed by the Group membership journey. The user has approved pulling the visible parts of the Group membership journey forward so the existing multi-group work is demonstrable on the apps, while keeping the Effective permissions bundle intact for the permission-gated management actions that should not yet ship.

In plain terms: this bundle is "make groups real on the apps, plus the smallest set of working actions, while leaving permission-gated management actions for the next bundle."

## Approved User Behavior

- A signed-in member sees real group names on the Groups screen instead of membership IDs.
- A member tapping any of their groups opens a Group details screen showing the group name, the member's own role, the group Owner, the full member roster with roles, and (for Owners only) the group's current invite link.
- A Member-role or Manager-role viewer never sees the invite link section and never sees rename controls.
- A Group Owner sees a rename affordance on the group name and can rename the group inline.
- A Group Owner sees the invite link with a Copy button and a Rotate-link button. Rotation invalidates the prior link and mints a new one.
- Anyone with the current invite link can join the group, regardless of who originally created it, until the link is rotated.
- A Platform Admin can open the web admin Groups page, tap Create group, enter a group name, pick an Owner from existing product users (the admin included), and submit. The new group appears in the admin list immediately with its owner and a freshly minted invite link.
- The Platform Admin's group create action is web admin only in this bundle. Mobile admin retains its current limited Groups view; mobile-admin create is deferred.
- Group creation, rename, and rotate-link all surface loading, success, validation-error, and retry states using the approved visual tokens.

## Scope

### Included

- Replace the rendered Groups list to show real group names instead of membership IDs.
- Add a Group details screen on web PWA, Android, and responsive web member shells.
- Surface group name, viewer role, group Owner, and full member roster on the details screen.
- Surface the current invite link with Copy and Rotate actions to Owners only.
- Add inline group rename, available to the active Group Owner only.
- Change the invitation model from expiring single-use tokens to one persistent, multi-use join link per group.
- Add a Platform Admin group-creation flow on the web admin portal: name + pick Owner from existing product users.
- Auto-mint one invite link per group at creation so a newly created group is immediately shareable.
- Server authorization for the new actions uses simple role checks against the active membership in the requested group.
- Migration to introduce the persistent-link table or fields, with safety preflight checks. The existing single-use invitation data is preserved read-only as audit history; new acceptances use the persistent-link path.
- Honest loading, empty, validation-error, retry, denied, and unavailable states across the new screens.
- Update `progress-tracker.md`, `architecture.md`, and `project-structure.md` to reflect the new invitation model and the new screens and APIs.

### Deferred

- Effective permissions and account-wide overrides. This remains the next foundation bundle. The simple role checks introduced here will be refactored to consult effective permissions once that bundle lands.
- Transfer ownership, leave group, remove member, suspend member, and other membership mutations. These wait for Effective permissions.
- Manager invitation authority. Still gated by the previously recorded product conflict; only Group Owners and Platform Admins control invite links in this bundle. Managers do not see the invite link section.
- Mobile admin Create group.
- Real restaurant, Favorites, order, notification, and file data.
- Public registration or self-serve group creation by non-admins.
- Per-member invitation tracking, expiry, or "pending invitations" UI. The persistent link has no per-recipient state in this bundle.

## Chosen Approach

### Persistent multi-use link per group, replacing single-use tokens

The current invitation model is expiring, single-use, deployment-bound tokens whose hashes are stored in Neon. Acceptance consumes the token.

This bundle replaces that model with one persistent, multi-use, deployment-bound join link per group. The public link value is still never stored in Neon — only its hash — so a database read cannot reveal a usable link. Acceptance no longer consumes the link. The link remains valid until a Group Owner rotates it (which mints a new public value and invalidates the old hash) or until the group is archived.

The single-use token table is preserved read-only for audit history. New acceptances use the new persistent-link table. No data is destroyed; the old table simply stops receiving writes.

Reason: the user-approved UX is "one link on the group I can copy and send to anyone." A single-use-per-person model would require the owner to mint a fresh link for each invitee, which the user explicitly did not choose. Persistent multi-use is the simplest model that matches the approved behavior and stays within free-tier infrastructure.

### Simple role checks now, refactor later

Rename, rotate-link, and group create all use direct role checks against the active membership (`owner`, `manager`, or `member`) and the platform-admin flag. These checks are isolated in small authorization helpers so the upcoming Effective permissions bundle can swap them out without touching route handlers or UI.

### Web admin only for create

Group creation is a Platform Admin action and lives on the web admin portal only. Mobile admin retains its current Groups view without a create button. This avoids widening mobile-admin write surface in this bundle.

### Inline rename, not a separate settings page

The rename affordance is a pencil icon on the group name in the Group details screen. Tapping enters an inline edit state with Save and Cancel. There is no separate "Group settings" page in this bundle. This keeps the scope small and the action discoverable.

## Data Model

### Persistent Invite Links

Add a new `group_invite_links` table (or equivalent) owned by `packages/db`:

- `id` — primary key.
- `group_id` — foreign key to `groups.id`. Indexed.
- `public_value_hash` — hash of the public link value; never the raw value itself.
- `public_value_prefix` — first several characters of the public value, used only to display "link ending in …abc" without exposing the full value.
- `created_by_user_id` — the product user who minted this link.
- `created_at` — UTC timestamp.
- `rotated_at` — nullable UTC timestamp. Set when a link is superseded by a new one.
- `status` — `active` or `rotated`. Exactly one row per group may be `active`. Enforced by partial unique index on `group_id` where `status = 'active'`.

The deployment-bound public value (the full URL or code) is reconstructed at request time from a stable deployment secret and the stored prefix plus a freshly generated random value. Only the hash is persisted. The exact reconstruction scheme is finalized in the implementation plan but must remain deterministic for verification and unpredictable to anyone reading only the database.

### Existing Single-Use Tokens

The existing invitations table is preserved unchanged. New rows are not written. Existing rows remain as audit history. Acceptance of an old-format token is no longer supported once this bundle ships; the public acceptance route only honors the new persistent-link format. Old tokens can still be read for audit purposes by Platform Admins through the existing audit tooling.

### Groups

The `groups` table already exists with at minimum an identifier and audit columns. This bundle requires `groups.name` to be a real, user-visible, mutable string. If the column does not yet exist or is unused, a migration adds or repurposes it. If the column already exists but was previously treated as internal-only, the migration is a no-op on the data and only the read/write surfaces change.

### Memberships

No schema change. The existing memberships table continues to represent one user's role in one group. The Group details screen reads from this table.

## Application Identity and Authorization

The current `AppIdentity` shape (introduced in the multi-group foundation) already carries `memberships` and `isPlatformAdmin`. This bundle adds no fields to that shape.

Authorization helpers introduced by this bundle:

- `requireGroupMembership(identity, groupId)` — used by the Group details read. Returns the viewer's membership so the route can branch on role. Rejects viewers with no membership in the requested group.
- `requireGroupRole(identity, groupId, "owner")` — used by rename and rotate-link.
- `requirePlatformAdmin(identity)` — used by group creation.

These helpers are deliberately small and isolated so the Effective permissions bundle can replace their internals without touching callers.

A Membership-only viewer (`role === "member"`) calling the invite-link or rename endpoints receives `FORBIDDEN` with the standard safe message. A Manager calling rename or rotate-link receives `FORBIDDEN` because both are owner-only in this bundle. A Group Owner calling either is permitted.

## Page and API Changes

### Member App Pages

- `(member)/groups` — replace the rendered list to show `group.name` rather than `group.id`. Tapping a row navigates to the new details route.
- `(member)/groups/[groupId]` — new route. Renders the Group details screen.
  - Owner, Manager, and Member viewers all see name, their own role, the Owner, and the member roster.
  - Owner viewers additionally see the rename affordance and the invite link section.

### Web Admin Pages

- `admin/groups` — extend to show `name` and current Owner. Add a "Create group" button that opens a name + Owner form. Existing per-group admin actions remain unchanged in this bundle.

### API Routes

All new routes follow the standard seven-step handler discipline (verify session, ensure identity, validate input, load roles, authorize, execute use case, return typed response).

- `GET /api/groups/:groupId/details` — returns name, viewer role, owner, member roster, and (if viewer is Owner) the active invite link's public value and prefix.
- `POST /api/groups/:groupId/rename` — owner-only. Body: `{ name: string }`. Validates non-empty, length cap, returns the updated group.
- `POST /api/groups/:groupId/invite-link/rotate` — owner-only. Mints a new public value, marks the prior active link `rotated`, returns the new public value and prefix.
- `POST /api/admin/groups` — platform-admin-only. Body: `{ name: string, ownerId: UserId }`. Creates the group, assigns the chosen user as Owner, auto-mints an invite link, returns the new group.
- The existing invitation acceptance route is updated to honor the new persistent-link format. It looks up the active link by public value hash, verifies deployment binding, and creates or reactivates the membership without consuming the link. Repeat acceptances from the same user return the existing `CONFLICT` response without writing a duplicate audit event.

## Data Flow

### Group Details Read

1. Client requests `GET /api/groups/:groupId/details`.
2. Server verifies session and loads `AppIdentity`.
3. Server locates the viewer's membership in `groupId`. If none, returns `FORBIDDEN`.
4. Server loads `group.name`, the active Owner, and the full member roster.
5. If the viewer's role is `owner`, server also loads the active invite link's public value and prefix.
6. Server returns the typed response. The client renders role-gated sections.

### Group Rename

1. Client sends `POST /api/groups/:groupId/rename` with the new name.
2. Server verifies session, loads identity, locates membership.
3. Authorization helper requires `owner`. Otherwise `FORBIDDEN`.
4. Validates the new name (non-empty, within length cap).
5. Use case updates `groups.name` and appends an audit event.
6. Server returns the updated group. The client updates the visible name.

### Rotate Invite Link

1. Client sends `POST /api/groups/:groupId/invite-link/rotate`.
2. Server verifies session, loads identity, locates membership.
3. Authorization helper requires `owner`. Otherwise `FORBIDDEN`.
4. Use case marks the prior active link `rotated`, mints a new public value, hashes it, stores the hash and prefix, and appends an audit event.
5. Server returns the new public value and prefix.

### Accept Invite Link

1. Visitor opens the deployment-bound join URL.
2. If unauthenticated, the page preserves the link through Better Auth Google sign-in (existing pattern).
3. Authenticated visitor's client posts the public value to the acceptance endpoint.
4. Server hashes the supplied value and looks up an `active` link with a matching hash.
5. If no match, or if the link is `rotated`, returns the existing safe `CONFLICT` response without revealing which.
6. Server verifies the deployment binding.
7. Server creates or reactivates the membership in the link's group, in one transaction, with an audit event.
8. The link is **not** consumed. A subsequent acceptance by a different user proceeds identically.

### Admin Create Group

1. Admin opens the web admin Groups page and taps Create group.
2. Admin enters a name and selects an Owner from existing product users.
3. Client posts to `POST /api/admin/groups`.
4. Server verifies session and requires `isPlatformAdmin`.
5. Validates the name and that the chosen `ownerId` corresponds to an active product user.
6. Use case creates the group, assigns the Owner membership, and auto-mints one invite link, all in one transaction with audit events.
7. Server returns the new group. The admin list updates.

## Error Handling

- Missing or invalid session: `UNAUTHENTICATED` with safe sign-in copy.
- Archived product user: `UNAVAILABLE` with the existing unavailable-account copy.
- Authenticated viewer without the requested group membership: `FORBIDDEN`.
- Member-role viewer calling rename, rotate-link, or invite-link read: `FORBIDDEN`.
- Manager-role viewer calling rename or rotate-link: `FORBIDDEN`.
- Non-platform-admin calling group create: `FORBIDDEN`.
- Invalid or unknown invite link at acceptance: the existing safe `CONFLICT` response that does not reveal whether the link existed.
- Expired single-use token presented at acceptance after this bundle ships: the same safe `CONFLICT` response.
- Name validation failure (empty or over the length cap): `INVALID_INPUT` with a plain-English field-level message.
- Migration preflight failure (for example, an unexpected active-invite-link duplication): abort the migration, report counts and identifiers without exposing private user data.
- Provider errors, SQL details, raw public link values, tokens, and stack traces never reach the client.

Clients show loading, empty, denied, unavailable, validation-error, and retry states using the existing visual tokens and English-only copy.

## Testing Strategy

All behavior is implemented test-first.

### Domain and Contracts

- Group details response parser accepts a payload with name, role, owner, members, and (conditionally) the invite link.
- Group details response parser rejects payloads missing required fields or carrying unknown role values.
- Rename request parser rejects empty or over-length names.
- Create-group request parser rejects empty names and invalid `ownerId` shapes.
- Invite-link acceptance request parser accepts a deployment-bound public value and rejects malformed inputs.

### Database and Migration

- The new `group_invite_links` table enforces exactly one `active` link per group via the partial unique index.
- Existing single-use invitation rows survive the migration unchanged.
- Existing memberships, users, audit rows, and group rows survive the migration unchanged.
- If `groups.name` did not exist prior, the migration adds it with a non-null default derived from a stable placeholder (for example, `"Group {id prefix}"`) so existing rows remain readable.
- An attempt to migrate with duplicate active links for one group aborts with a clear preflight error.
- The Drizzle migration journal contains the new migration in order.

### Identity and Authorization

- An Owner calling rename or rotate-link is permitted.
- A Manager calling rename or rotate-link is forbidden.
- A Member calling rename, rotate-link, or invite-link read is forbidden.
- A non-platform-admin calling group create is forbidden.
- A platform admin calling group create is permitted.
- A user without any membership in the requested group is forbidden from every group-scoped endpoint.

### Services and Routes

- Group details returns the active invite link only when the viewer is Owner.
- Rotate-link marks the prior link `rotated`, mints a new public value, stores only the hash, and returns the new public value.
- Group create assigns the chosen Owner and auto-mints one active invite link in one transaction.
- Acceptance of an active persistent link creates or reactivates exactly one membership per user per group.
- Repeat acceptance by an already-active member returns `CONFLICT` without writing a duplicate audit event.
- Acceptance of a rotated link returns the safe `CONFLICT` response.
- Old single-use tokens presented after the migration are rejected with the safe `CONFLICT` response.
- Rename writes a group audit event. Rotate-link writes an invite-link audit event. Create-group writes both a group-create and an ownership-assignment audit event.

### Clients

- Web PWA, responsive web member shell, and Android all render the Groups list with real group names.
- Tapping a group navigates to the Group details screen.
- An Owner viewer sees the rename affordance and the invite link section. Rename saves inline; rotation replaces the visible link.
- A Manager viewer sees neither the rename affordance nor the invite link section.
- A Member viewer sees neither the rename affordance nor the invite link section.
- The web admin Groups page shows the Create group button. Submitting with valid input adds the new group to the list.
- All loading, empty, validation-error, denied, unavailable, and retry states render using the approved visual tokens.
- Cookie-free requests do not render protected content.

### Completion Verification

- Focused tests pass after each RED-to-GREEN cycle.
- Provider-free unit tests, mobile tests, type checking, linting, formatting, and builds pass.
- Provider-backed migration and transaction tests pass against the development Neon branch with rollback-only or temporary-schema isolation.
- Next.js production build and Android export pass.
- Browser checks cover cookie-free, no-membership, member-viewer, manager-viewer, owner-viewer, and platform-admin states.
- Android emulator checks cover member-viewer, manager-viewer, and owner-viewer states on the Group details screen.
- Client secret scans remain clean.

## Documentation Changes

- Update `context/progress-tracker.md` to add this bundle's completion line and mark the visible-parts of the Group membership journey as addressed, while Effective permissions remains pending.
- Update `context/architecture.md` to describe the new persistent, multi-use, deployment-bound invite link model and remove the language about consuming single-use tokens.
- Update `context/project-structure.md` for the new member and admin routes and the new `group_invite_links` repository.
- Update `context/code-standards.md` only if a reusable group-authorization convention emerges that is not already covered.
- Update `context/design-structure.md` and `context/ui-context.md` only if the new Group details screen introduces a new shared UI rule.
- Move completion evidence into a focused history document when the bundle is squash-merged to `main`.

## Deployment and External Gates

No new provider, paid plan, environment variable, or credential is required.

External work is deliberately gated:

1. Local/provider-free implementation and tests run first.
2. Before provider-backed tests, confirm the existing development Neon variables are available without printing them.
3. Provider-backed tests use rollback-only or temporary-schema isolation.
4. Before applying the migration to the persistent development or production Neon database, report the exact target, migration name, preflight checks, rollback boundary, and expected application downtime.
5. Apply no persistent external migration without explicit user direction at that gate.

## Dependencies and Forward Constraints

- This bundle introduces simple role checks in small helpers. The Effective permissions bundle must replace these helpers' internals without changing their signatures, so route handlers and UI do not need to change again.
- The persistent invite link model replaces the single-use token model for new acceptances. Any future feature that assumes per-person invitation tracking must add a layer on top of the persistent-link model; it cannot assume single-use semantics.
- The Group details screen exposes a fixed surface today (name, role, owner, members, link, rename). Future management actions (transfer ownership, remove member, leave group) are added as additional sections in subsequent bundles and must continue to honor the same role-gating rules.

## Completion Criteria

The bundle is complete only when:

- a signed-in member sees real group names on the Groups screen and can tap into a Group details screen on web PWA, Android, and responsive web;
- the Group details screen correctly shows or hides the invite link section and rename affordance based on the viewer's role in that group;
- a Group Owner can rename the group inline and rotate the invite link;
- a Manager or Member cannot rename, cannot rotate the link, and does not see the invite link section;
- anyone with the current persistent invite link can join the group, repeat acceptances are safe, and rotated links stop working;
- a Platform Admin can create a new group on the web admin portal with a name and chosen Owner, and the new group is immediately usable;
- the migration is safe, the existing single-use token data is preserved read-only, and exactly one active invite link per group is enforced;
- web, Android, database, and provider-backed verification pass; and
- documentation and the progress tracker match the verified result.
