# Multi-Group Foundation Design

## Goal

Replace the current one-group access boundary with a group-scoped identity model that lets any authenticated Google user browse the member application and belong to several private groups with a different role in each group.

This bundle also completes the approved Organizer-to-Manager terminology change before later catalog, permission, and order journeys build on the old name.

## Why This Bundle Comes First

The current database allows only one active membership per user, and the current application identity selects only the first active membership. Every later group, permission, and order feature would therefore authorize against the wrong boundary if it were connected now.

In simple terms: the app expects one person to have several group keys, but the backend currently keeps only one key in its hand. This bundle teaches the backend to keep the full key ring and to check the correct key for each group.

## Approved User Behavior

- A Google-authenticated user does not need a group invitation to enter the member application.
- A user with no group memberships may use Home, restaurant browsing, and Favorites.
- Orders and Groups remain visible but show honest empty or join states when the user has no applicable data.
- A user may hold active memberships in several groups.
- The same user may be a Group Owner in one group, a Manager in another, and a Member in another.
- Group membership never enrolls the user in an order.
- Platform Admin remains an account-wide role; Group Owner, Manager, and Member remain group-specific roles.

## Scope

### Included

- Provision or resolve a product user after Better Auth Google sign-in without requiring an invitation.
- Protect member pages with a valid Better Auth session.
- Protect every `/admin` page with both a valid session and the Platform Admin role.
- Replace the single-group application identity with all active memberships.
- Require group-specific authorization for existing invitation, member-management, and admin-request actions.
- Remove the one-active-group-per-user database restriction.
- Preserve existing membership, invitation, user, and audit data.
- Rename Organizer to Manager across database values and identifiers, domain types, contracts, server behavior, tests, and current UI copy.
- Enforce no more than one active Group Owner per group in the database.
- Reject operations that would remove, transfer, or duplicate active group ownership.

### Deferred

- Effective permission grants and blocks.
- Account and group suspension behavior.
- Manager promotion acceptance.
- Group creation, leaving, rejoining, and archival workflows.
- Real restaurant, Favorites, order, notification, and file data.
- Manager invitation authority. The product questionnaire remains contradictory on that permission, so only Group Owners and Platform Admins are approved inviters for now.

## Chosen Approach

Use one clean cutover rather than supporting both Organizer and Manager as long-lived aliases.

The app has no distributed Android release yet, so there is no installed-client compatibility reason to keep the old role name. Removing the old name now makes later permission and order work smaller and prevents mixed authorization vocabulary.

## Data Model

### Memberships

- Drop the partial index `memberships_one_active_group_per_user`.
- Keep the existing `(group_id, user_id)` primary key so one user has one membership record per group.
- A removed membership may still be reactivated by clearing `removed_at`; existing audit events remain the permanent record of membership changes.
- Add a partial unique index on `group_id` for active rows whose role is `owner`. This prevents two active owners in one group.
- Database uniqueness provides **at most one** active owner. Service transactions and migration verification provide the **at least one** rule for every active group.

### Organizer-to-Manager Rename

The migration changes the stored vocabulary without replacing or deleting rows:

- `membership_role`: `organizer` becomes `manager`.
- `order_participant_role`: `organizer` becomes `manager`.
- `food_selection_source`: `organizer_resolution` becomes `manager_resolution`.
- Order and domain identifiers such as `organizer_user_id`, `organizerId`, and `organizerResolutions` become their Manager equivalents.
- Constraint and index names containing `organizer` are renamed or recreated with `manager` terminology.

The migration must not edit any already-applied migration. It creates a new ordered Drizzle migration and matching snapshot/journal entry.

### Migration Safety

Before changing data, the migration verification checks:

1. Every active group has exactly one active owner.
2. No group has duplicate active membership rows for the same user.
3. Existing role values are limited to the known old enum values.

If a check fails, the migration stops. It does not guess which person should own a group or silently remove membership data.

## Application Identity

Replace the current identity shape that exposes one optional `groupId` and aggregated group roles.

The new identity shape contains:

```ts
export interface AppIdentity {
  readonly authUserId: string;
  readonly isPlatformAdmin: boolean;
  readonly memberships: readonly GroupMembershipIdentity[];
  readonly userId: UserId;
}

export interface GroupMembershipIdentity {
  readonly groupId: GroupId;
  readonly role: "group-owner" | "manager" | "member";
}
```

This prevents a Manager role from one group being accidentally reused in another group. Platform Admin stays explicit and account-wide instead of being mixed into group roles.

Small authorization helpers locate the membership for the requested `groupId` and enforce the required group role. Existing route handlers must pass the resource group explicitly; they may not use a first or default membership.

## Authentication and Page Access

### Member Pages

- A missing Better Auth session shows the approved minimal Google sign-in experience.
- A valid session provisions or refreshes the product user and loads all active memberships.
- No invitation is required to render authenticated Home, restaurant, or Favorites areas.
- No-membership Orders and Groups views show clear empty states instead of an authorization error.

### Admin Pages

- Every `/admin` layout render reads the Better Auth session on the server.
- An unauthenticated request receives the sign-in state and no admin navigation.
- An authenticated non-Platform Admin receives an honest no-access state and no protected admin shell.
- API authorization remains independent. Protecting the page never replaces route-level authorization.

## Existing Access Flows

### Invitation Acceptance

- Accepting an invitation no longer rejects a user merely because another active membership exists.
- It still rejects an expired, already-used, or invalid deployment-bound token.
- It creates or reactivates membership only for the invitation's group.
- Accepting a group already actively joined returns a stable conflict response without duplicating audit history.
- Invitation acceptance and the audit event remain one transaction.

### Group Actions

- Existing member listing and member mutations require a membership in the requested group plus the required role.
- Group A authority grants nothing in Group B.
- The active owner cannot be promoted, demoted, removed, or transferred by these existing actions.
- Manager invitation authority remains unavailable until the recorded product conflict is resolved.

### Platform-Admin Requests

- A Group Owner may submit the request using the ownership held in the specified group.
- The request cannot rely on a default or first membership.
- Platform Admin approval remains account-wide and keeps its existing transactional audit behavior.

## Data Flow

1. Better Auth verifies the web cookie or Android SecureStore-backed cookie.
2. The server provisions or refreshes the provider-neutral product user.
3. The identity repository returns every active membership for that user.
4. The server maps stored `owner`, `manager`, and `member` values into group-scoped application roles.
5. A route validates its input and identifies the target group.
6. The authorization helper finds the matching membership and checks the required role.
7. The use case runs in the existing transaction boundary and appends its audit event when required.
8. The client receives only the memberships and account role needed for navigation and display.

## Error Handling

- Missing or invalid session: `UNAUTHENTICATED` with safe sign-in copy.
- Archived product user: `UNAVAILABLE` with the existing unavailable-account copy.
- Authenticated user without the requested group membership: `FORBIDDEN`.
- Role in another group but not the requested group: `FORBIDDEN`.
- Already-active membership in the invitation's group: `CONFLICT`.
- Expired, used, or invalid invitation: the existing safe `CONFLICT` response that does not reveal token details.
- Attempt to remove or change the active Group Owner through an unsupported flow: `CONFLICT`.
- Migration ownership inconsistency: abort the migration and report counts and record identifiers without exposing private user data.

Clients show loading, empty, denied, unavailable, and retry states using the existing visual tokens and English-only copy. Provider errors, SQL details, tokens, and stack traces never reach the client.

## Testing Strategy

All behavior is implemented test-first.

### Domain and Contracts

- Group role values expose Manager and contain no active Organizer alias.
- Group membership identity parsing accepts several groups with different roles.
- Strict parsers reject duplicate group memberships and unknown role values where applicable.

### Database and Migration

- Existing memberships, invitations, users, and audit rows survive the migration.
- One user can hold active memberships in several groups.
- A user cannot hold duplicate membership rows in the same group.
- A group cannot have two active owners.
- Existing Organizer data is preserved under the Manager value and renamed identifiers.
- The Drizzle migration journal contains the new migration in order.

### Identity and Authorization

- A user with no membership still receives an authenticated identity.
- All active memberships are returned deterministically.
- A Manager in Group A is forbidden from Manager actions in Group B.
- Platform Admin remains account-wide.
- Archived users remain unavailable.

### Access Services and Routes

- A user already in Group A may accept an invitation to Group B.
- A duplicate Group B acceptance is rejected safely.
- Invitation, member-management, and admin-request actions use the requested group.
- Owner-protection and cross-group authorization failures write no mutation audit event.
- Cookie-free member and admin page requests do not render protected content.
- Authenticated non-admin requests do not render the admin shell.

### Clients

- Web and Android render the no-membership Home state without blocking restaurant or Favorites navigation.
- Orders and Groups render honest empty states.
- Several memberships render with the exact Group Owner, Manager, and Member labels.
- Existing invitation return paths still work after Google sign-in.

### Completion Verification

- Focused tests pass after each RED-to-GREEN cycle.
- Provider-free unit tests, mobile tests, type checking, linting, formatting, and builds pass.
- Provider-backed migration and transaction tests pass against the development Neon branch.
- Next.js production build and Android export pass.
- Browser checks cover cookie-free, no-membership, multi-membership, cross-group denial, and non-admin `/admin` access.
- Android emulator checks cover sign-in, no-membership, and multi-membership states.
- Client secret scans remain clean.

## Documentation Changes

- Update `context/progress-tracker.md` after each meaningful implementation unit and when the bundle completes.
- Update `context/architecture.md` when the new identity and group authorization boundary lands.
- Update `context/project-structure.md` for new or moved modules.
- Update `context/code-standards.md` only if implementation introduces a reusable group-authorization convention not already covered.
- Update `context/design-structure.md` and `context/ui-context.md` only if the approved no-membership interaction requires a new shared UI rule.
- Move completion evidence into a focused history document when the bundle is squash-merged to `main`.

## Deployment and External Gates

No new provider, paid plan, environment variable, or credential is required.

External work is deliberately gated:

1. Local/provider-free implementation and tests run first.
2. Before provider-backed tests, confirm the existing development Neon variables are available without printing them.
3. Provider-backed tests use rollback-only or temporary-schema isolation.
4. Before applying the migration to the persistent development or production Neon database, report the exact target, migration name, preflight checks, rollback boundary, and expected application downtime.
5. Apply no persistent external migration without explicit user direction at that gate.

## Completion Criteria

The bundle is complete only when:

- authenticated users can enter without an invitation;
- one user can belong to several groups;
- every group action uses the role from the requested group;
- Organizer is removed from active product vocabulary and stored data;
- existing access flows and audit history remain intact;
- member and admin pages enforce real session and authorization boundaries;
- web, Android, database, and provider-backed verification pass; and
- documentation and the progress tracker match the verified result.
