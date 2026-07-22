# Code Standards

## General

- Use strict TypeScript across apps and packages.
- Keep modules small and single-purpose.
- Fix root causes rather than layering workarounds.
- Keep provider code behind interfaces owned by the relevant package.
- Add a simple one-sentence description above every exported function and every non-obvious internal function explaining what it does and why it exists.
- Do not mix UI, authorization, persistence, scheduling, and notification delivery in one function.

## TypeScript

- Do not use `any`; validate unknown values and narrow them.
- Use discriminated unions for order states and import outcomes.
- Represent money as integer Philippine centavos, never floating-point pesos.
- Store timestamps in UTC and render them in the user's timezone.
- Prefer immutable input and return types for domain functions.
- Exhaustively handle state and role unions.

## Domain Logic

- Keep voting, ranking, threshold, fallback, availability, subtotal, and state-transition logic in `packages/domain`.
- Domain functions are deterministic and side-effect free when possible.
- Test threshold boundaries, ties, non-response, unavailable favorites, and retries explicitly.
- Do not duplicate business rules in Android and web clients.

## Expo Android

- Use Expo Router for navigation.
- Keep screens focused on orchestration and presentation.
- Isolate native modules and platform behavior behind small adapters.
- Never place server secrets in `EXPO_PUBLIC_*` variables.

## Next.js

- Default to Server Components for web read views.
- Use Client Components only for browser interaction.
- Route Handlers remain thin and call shared application services.
- Use direct-to-R2 signed uploads for files; do not proxy large files through Vercel.
- The iPhone PWA and admin portal may share primitives but must not share inappropriate layouts.

## API Routes

Every route performs these steps in order:

1. Verify the Clerk session.
2. Validate request input.
3. Load application identity and roles from Neon.
4. Authorize the resource action.
5. Execute one use case.
6. Return a consistent typed response.

Use stable error codes and safe user messages. Never expose provider credentials, SQL details, or stack traces.

## Database

- Use migrations for every schema change.
- Use foreign keys, unique constraints, and check constraints for enforceable rules.
- Use transactions for multi-record mutations and state transitions.
- Use the pooled Neon connection for serverless request traffic.
- Copy menu price and description snapshots into order history.
- Do not hard-delete records required by order history or audit trails.

## Storage

- Use private R2 buckets.
- Validate MIME type, size, ownership, and object purpose before signing an upload.
- Use unpredictable object keys; do not include private names or emails in paths.
- Store object metadata and ownership in Neon.

## Notifications and Jobs

- Create provider-neutral notification events before calling OneSignal.
- Record delivery attempts and provider identifiers.
- Verify QStash signatures and use idempotency keys.
- A notification failure must not reverse a valid order transition.

## Testing

- Unit-test domain rules and validators.
- Integration-test API authentication, authorization, Neon transactions, R2 signing, and idempotent jobs.
- End-to-end test the complete V1 loop on Android and the iPhone PWA.
- Verify responsive admin behavior separately.
- Run pure shared-package and server tests through the named Node projects in `vitest.config.ts`.
- Keep Expo Router tests outside `apps/mobile/app`; use Jest with `jest-expo` and React Native Testing Library under `apps/mobile/__tests__`.
- Keep Playwright member and admin browser tests in separate projects under `tests/e2e`.
- Name provider-dependent Vitest files `*.provider.integration.test.ts` and Playwright files `*.provider.spec.ts`; run them only through their explicit provider scripts until development services exist.
- Keep the default `npm test` and continuous-integration job independent of provider credentials.
- Every completed unit must pass type checking, linting, focused tests, and production builds.

## Styling

- Use only the approved Option 1 tokens from `design-structure.md` and `ui-context.md`.
- Define colors, spacing, radii, typography, and elevation once in shared tokens; do not scatter raw values through screens.
- Preserve accessible contrast and focus behavior.
- Keep application-authored strings and test fixtures in English. Do not translate or normalize externally imported proper names.
