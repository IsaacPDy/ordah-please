# Better Auth Migration Design

## Goal

Replace Clerk with self-hosted Better Auth without changing the product's invitation-only access model, internal user IDs, Neon-owned roles, group membership, or permanent order history.

## Why This Change Exists

Google OAuth proves that a person controls a Google identity. Better Auth turns that proof into an application session. The application then maps the authenticated identity to its provider-neutral product user and checks roles stored in Neon.

Keeping those three jobs separate prevents an authentication provider from becoming the owner of product permissions or historical records.

## Approved Architecture

```text
Google OAuth
    -> Better Auth in the existing Next.js application
        -> auth_users, auth_sessions, auth_accounts, auth_verifications in Neon
            -> product users through users.auth_user_id
                -> memberships, roles, invitations, orders, and history
```

- Better Auth is self-hosted inside `apps/web` and deployed with the existing Next.js application on Vercel.
- Better Auth Infrastructure is not used.
- Google is the only V1 sign-in method. Email/password and public registration stay disabled.
- Authentication tables remain separate from the product `users` table.
- `users.auth_user_id` is nullable and unique so existing product users may remain unlinked until a controlled migration links them.
- Product roles, group membership, invitations, and order participation remain in product tables.
- Authentication deletion or session revocation never deletes product history.
- Old generated migrations remain immutable evidence even when their historical SQL mentions Clerk.

## Session Model

- Web sessions use Better Auth's same-origin, HTTP-only cookies.
- Android uses the Better Auth Expo client plugin and Expo SecureStore-backed cookie storage.
- Android sends the Better Auth session cookie to the trusted API and never receives a server secret.
- Every protected route verifies the Better Auth session from request headers, ensures or loads the product identity, validates input, loads roles, authorizes the resource action, executes one use case, and returns a safe typed result.
- Revoked, expired, missing, or forged sessions are unauthenticated.

## Google OAuth Boundary

- The Google OAuth audience is External and its publishing status remains Testing for the private prototype.
- The application requests only `openid`, `email`, and `profile`.
- Separate OAuth clients and Better Auth secrets are used for development, preview, and production.
- Exact callback origins must match their environment.
- Google identity data never supplies platform-admin, group-owner, organizer, or member roles.

## Identity Provisioning

On the first valid authenticated request, the application creates or reuses one product user linked by `auth_user_id`. A unique database constraint prevents concurrent requests from creating duplicate mappings.

Existing product users are linked only through a guarded development command that:

- requires explicit development confirmation;
- rejects production;
- rejects duplicate or conflicting links;
- writes the link and audit event in one transaction; and
- never prints an email, session token, credential, or database URL.

Archived product identities remain rejected even if Better Auth still has an active session.

## Failure and Rollback

- Missing or invalid auth configuration fails with the variable name but never its value.
- An untrusted origin is rejected before an auth mutation.
- A Better Auth failure does not bypass product authorization.
- Before Clerk retirement, rollback may redeploy the last verified Clerk commit while leaving additive Better Auth tables unused.
- After Clerk retirement, Better Auth records are preserved for diagnosis.
- Rollback never deletes product users, memberships, invitations, catalog data, audit history, or order history.

## Verification

- Dependency policy tests forbid Clerk packages and `@better-auth/infra`.
- Schema tests prove the four auth tables, one-to-one product mapping, explicit deletion behavior, and product-history survival.
- Session tests reject missing, invalid, expired, revoked, and forged cookies.
- Web tests prove Google sign-in, return-to-invitation, acceptance, sign-out, and safe errors.
- Android tests prove deep-link return, invitation preservation, SecureStore cookie persistence, authenticated API requests, sign-out, and expiry recovery.
- Provider-backed tests prove the migration against disposable or development Neon state.
- Built-client scans prove that Better Auth, Google, Neon, and other server secrets are absent.

## Retired Clerk Boundary

Clerk packages, runtime code, environment variables, webhooks, and active setup instructions are removed after the Better Auth cutover passes web and Android verification. Historical generated migrations and historical tracker notes may continue to name Clerk because rewriting evidence would make the migration record false.

