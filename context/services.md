# Services Setup and Variable Registry

This file is the setup map for every external service approved for V1. It records variable names and where values belong, but it must never contain real passwords, tokens, private keys, connection strings, or credential files.

## First Principle

A variable is a named slot. The code reads the slot; the real value lives outside the repository. This lets development, preview, and production use different accounts without rewriting code.

Use three classes:

| Class | Meaning | Safe in client code? | Where the real value belongs |
| --- | --- | --- | --- |
| Public | Identifier or URL that users can see | Yes | EAS or Vercel environment settings |
| Server secret | Grants access or signs requests | No | Vercel encrypted environment settings; local `.env.local` only when required |
| Build identity | Controls the installed app's name or package | It is not a secret | Shared app configuration and EAS environment settings |

Anything prefixed with `NEXT_PUBLIC_` or `EXPO_PUBLIC_` is compiled into a client bundle and can be read by users. Never place a secret in those variables.

## Canonical Product Identity

These are not provider secrets. Keep them together because a rename can affect several services.

| Variable | Current value | Purpose | Update locations when changed |
| --- | --- | --- | --- |
| `APP_DISPLAY_NAME` | `ordah please` | Visible application name | Expo app config, PWA manifest and metadata, Google OAuth branding, OneSignal application/site name, documentation |
| `APP_SLUG` | `ordah-please` | Technical project slug | Expo `slug`, EAS project settings, Vercel project name if desired, documentation |
| `ANDROID_APPLICATION_ID` | `ordahplease.app` | Permanent Android package and namespace | Expo `android.package`, OneSignal Android platform, Firebase/FCM registration, EAS credentials |
| `APP_SCHEME` | `ordahplease` | Mobile deep-link and authentication callback scheme | Expo `scheme`, Better Auth trusted origins, Android intent filters |
| `APP_BASE_URL` | Environment-specific HTTPS origin | Canonical web/API origin used by the server | Vercel, Better Auth base URL, Google OAuth callbacks, QStash callback destinations, OneSignal web settings |
| `EXPO_PUBLIC_API_URL` | Environment-specific API origin | Android client API base URL | Local mobile environment and every EAS environment |
| `NEXT_PUBLIC_APP_URL` | Environment-specific web origin | Browser-visible canonical web URL | Local web environment and every Vercel environment |

Do not casually change `ANDROID_APPLICATION_ID` after distributing the first APK. Android treats a different package ID as a different application, not a rename.

## Master Variable Inventory

The names below are the V1 contract. Real values are deliberately omitted.

| Service | Variable | Class | Required for | Stored in |
| --- | --- | --- | --- | --- |
| App identity | `APP_DISPLAY_NAME` | Build identity | Expo config and shared metadata | EAS plus local build environment |
| App identity | `APP_SLUG` | Build identity | Expo/EAS project config | EAS plus local build environment |
| App identity | `ANDROID_APPLICATION_ID` | Build identity | Android package | EAS plus local build environment |
| App identity | `APP_SCHEME` | Build identity | Deep links and mobile OAuth return | EAS plus local build environment |
| App origin | `APP_BASE_URL` | Public server config | Webhooks, scheduled callbacks, absolute server links | Vercel server environment |
| Mobile API | `EXPO_PUBLIC_API_URL` | Public | Android API requests | EAS and local mobile environment |
| Web origin | `NEXT_PUBLIC_APP_URL` | Public | Browser-visible canonical URLs | Vercel and local web environment |
| Neon | `DATABASE_URL` | Server secret | Runtime pooled Postgres connection | Vercel and local web environment |
| Neon | `DATABASE_MIGRATION_URL` | Server secret | Direct connection for schema migrations | Local/CI migration environment only |
| Neon development seed | `DATABASE_SEED_CONFIRMATION` | Non-secret safety control | Explicitly allowing deterministic fixture seeding | Local development only; never Vercel or production |
| Neon identity link | `DATABASE_IDENTITY_LINK_CONFIRMATION` | Non-secret safety control | Explicitly allowing a one-time development auth-to-product link | Local development only; never Vercel or production |
| Better Auth | `BETTER_AUTH_SECRET` | Server secret | Signing and protecting Better Auth cookies and state | Vercel and local web environment; unique per environment |
| Better Auth | `BETTER_AUTH_URL` | Server config | Exact Better Auth server origin | Vercel and local web environment |
| Google OAuth | `GOOGLE_CLIENT_ID` | Server config | Identifying the environment's Web OAuth client | Vercel and local web environment |
| Google OAuth | `GOOGLE_CLIENT_SECRET` | Server secret | Exchanging Google OAuth codes | Vercel and local web environment |
| R2 | `R2_ACCOUNT_ID` | Server config | Building the R2 endpoint | Vercel and local web environment |
| R2 | `R2_BUCKET_NAME` | Server config | Selecting the private bucket | Vercel and local web environment |
| R2 | `R2_ENDPOINT` | Server config | S3-compatible client endpoint | Vercel and local web environment |
| R2 | `R2_ACCESS_KEY_ID` | Server secret | R2 S3 authentication | Vercel and local web environment |
| R2 | `R2_SECRET_ACCESS_KEY` | Server secret | R2 S3 authentication | Vercel and local web environment |
| OneSignal | `EXPO_PUBLIC_ONESIGNAL_APP_ID` | Public | Android SDK initialization | EAS and local mobile environment |
| OneSignal | `NEXT_PUBLIC_ONESIGNAL_APP_ID` | Public | Web SDK initialization | Vercel and local web environment |
| OneSignal | `ONESIGNAL_APP_API_KEY` | Server secret | Sending app-level notifications | Vercel and local web environment |
| QStash | `QSTASH_TOKEN` | Server secret | Publishing delayed and scheduled work | Vercel and local web environment |
| QStash | `QSTASH_CURRENT_SIGNING_KEY` | Server secret | Verifying incoming QStash requests | Vercel and local web environment |
| QStash | `QSTASH_NEXT_SIGNING_KEY` | Server secret | Safe verification during key rotation | Vercel and local web environment |
| QStash local emulator | `QSTASH_URL` | Local config | Pointing the SDK to a local QStash server | Local development only; omit in hosted V1 unless required |
| Expo EAS | `EAS_PROJECT_ID` | Public build config | Linking local Expo config to the EAS project | EAS project config and local build environment |
| Expo EAS | `EXPO_OWNER` | Public build config | Selecting the Expo account/organization | Expo app config if the project uses an owner field |

## Recommended Environment Separation

Use three environments from the beginning:

| Environment | Purpose | Vercel | EAS |
| --- | --- | --- | --- |
| Development | Local coding and test accounts | Development | `development` |
| Preview | Safe deployed testing | Preview | `preview` |
| Production | Private real use by friends | Production | `production` |

Do not reuse production database, Better Auth secret, Google OAuth client, R2 bucket, or notification credentials in development. A test should not be able to notify real users or modify real menus.

## 1. Neon PostgreSQL

### Why it exists

Neon stores structured application truth: users, roles, groups, catalog records, favorites, orders, votes, history, and audit events.

### Setup

1. Create a Neon account and a project for development.
2. Choose the region closest to the expected users when possible.
3. Create or select the application database.
4. Open **Connect** in the Neon dashboard.
5. Enable connection pooling and copy the pooled connection string into `DATABASE_URL` outside the repository.
6. Copy a direct, non-pooled connection string into `DATABASE_MIGRATION_URL` for Drizzle migration commands.
7. Repeat with a separate production project or protected production branch before real use.
8. Add `DATABASE_URL` to Vercel Development, Preview, and Production using the correct value for each environment.
9. Keep `DATABASE_MIGRATION_URL` restricted to the machine or CI job that is allowed to change the schema.
10. Give Preview and Production separate pooled login roles with only the table and sequence permissions required by the application. Keep schema-owner credentials out of the Vercel runtime.

### Development fixtures

The seed command requires `NODE_ENV=development` and the exact non-secret confirmation `DATABASE_SEED_CONFIRMATION=ordah-please-development-seed`. Store the confirmation only in the gitignored local development environment; never add it to Vercel or production.

From the repository root, load the local web environment explicitly and run:

```sh
NODE_ENV=development node --env-file=apps/web/.env.local --import tsx packages/db/src/dev/seed-cli.ts
```

The command uses the pooled `DATABASE_URL`, runs all fixture writes in one transaction, and restores the same deterministic fictional rows on every rerun. It never uses `DATABASE_MIGRATION_URL`.

### Development identity linking

The controlled link command requires `NODE_ENV=development`, `DATABASE_IDENTITY_LINK_CONFIRMATION=ordah-please-development-auth-link`, `AUTH_USER_ID`, and `PRODUCT_USER_ID`. The two IDs select records but are never printed. The command rejects production, archived users, missing records, and duplicate links, then writes the link and audit event in one transaction:

```sh
NODE_ENV=development node --env-file=apps/web/.env.local --import tsx packages/db/src/dev/link-auth-identity-cli.ts
```

### Rename and rotation checklist

- Renaming a Neon project in its dashboard is usually cosmetic; the application changes only if the connection string changes.
- Changing project, branch, database, role, password, or region can change a connection string. Update `DATABASE_URL` and `DATABASE_MIGRATION_URL`, then redeploy.
- Never expose either URL to Expo or browser code.

Official references: [Neon connection pooling](https://neon.com/docs/connect/connection-pooling), [Better Auth Drizzle adapter](https://better-auth.com/docs/adapters/drizzle).

## 2. Better Auth and Google OAuth

### Why it exists

Google proves control of a Google identity. Self-hosted Better Auth creates and verifies the application's session. Neon product tables—not Google or Better Auth—store roles and group membership.

### Setup

1. Use the existing Google Cloud project only for the matching environment; keep development, preview, and production isolated.
2. In Google Auth Platform, configure an External audience and keep Publishing status as Testing for the private prototype.
3. Request only `openid`, `email`, and `profile`. Do not enable Drive, Gmail, Calendar, or another sensitive scope.
4. Create a Web OAuth client and add exact callback URLs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://<exact-preview-origin>/api/auth/callback/google`
   - `https://ordah-please-web.vercel.app/api/auth/callback/google`
5. Store the client identifier as `GOOGLE_CLIENT_ID` and its secret as `GOOGLE_CLIENT_SECRET` only in the local server environment and Vercel.
6. Generate a strong, environment-specific `BETTER_AUTH_SECRET`. Never reuse development, preview, and production values.
7. Set `BETTER_AUTH_URL` to the exact origin for that environment, with no path suffix.
8. Keep `APP_SCHEME=ordahplease` in Expo and trust `ordahplease://` in the Better Auth server.
9. Keep browser authentication same-origin. Android uses the Better Auth Expo plugin and SecureStore-backed cookie storage.
10. Do not create a Better Auth Infrastructure account or API key. V1 uses only the self-hosted framework.
11. Redeploy after any Vercel auth-variable change.

### Rename and rotation checklist

- Changing domains requires updating `BETTER_AUTH_URL`, `APP_BASE_URL`, `NEXT_PUBLIC_APP_URL`, Better Auth trusted origins, and exact Google OAuth callback URLs.
- Rotating `BETTER_AUTH_SECRET` invalidates or changes the validation of protected cookies; use a controlled session-expiry window and redeploy.
- Rotating the Google OAuth client secret requires updating `GOOGLE_CLIENT_SECRET` and redeploying before revoking the old value.
- Recreating the OAuth client changes both Google variables and every registered callback.
- Authentication deletion must never hard-delete the provider-neutral product user or its history.

Official references: [Better Auth installation](https://better-auth.com/docs/installation), [Better Auth Expo integration](https://better-auth.com/docs/integrations/expo), [Better Auth cookies](https://better-auth.com/docs/concepts/cookies), [Google OAuth app states](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview).

## 3. Cloudflare R2

### Why it exists

R2 stores private file bytes: restaurant thumbnails, import files, validation reports, and optional receipts. Neon stores only object keys and metadata.

### Setup

1. Open Cloudflare **Storage & Databases > R2** and create a private development bucket.
2. Record the bucket name as `R2_BUCKET_NAME`.
3. Record the Cloudflare account ID as `R2_ACCOUNT_ID`.
4. Set `R2_ENDPOINT` to the S3-compatible endpoint shown by R2. Its normal form is `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`; use the dashboard value because jurisdictional buckets use different endpoints.
5. Create an R2 API token with **Object Read & Write** permission limited to this bucket.
6. Store its access-key value as `R2_ACCESS_KEY_ID` and its secret value as `R2_SECRET_ACCESS_KEY` only in Vercel/local server settings.
7. Keep public bucket access disabled. The API will authorize users and issue short-lived presigned URLs.
8. Use a separate production bucket and bucket-scoped token.

### Rename and rotation checklist

- A bucket-name change is a storage migration: create the new bucket, copy objects, update `R2_BUCKET_NAME`, verify, and only then retire the old bucket.
- An account or jurisdiction change also requires updating `R2_ACCOUNT_ID` and `R2_ENDPOINT`.
- Rotating the R2 token changes both key variables. Update Vercel and redeploy before revoking the old token.
- Never send the parent R2 credentials to Android or web clients.

Official references: [Cloudflare R2 S3 setup](https://developers.cloudflare.com/r2/get-started/s3/), [R2 API-token permissions](https://developers.cloudflare.com/r2/api/tokens/), [R2 presigned and temporary access guidance](https://developers.cloudflare.com/r2/api/s3/temporary-credentials/).

## 4. Vercel Hosting and API

### Why it exists

Vercel hosts the Next.js PWA, admin portal, and trusted API boundary. It is also the primary secret store for server runtime variables.

### Setup

1. Create a Vercel project linked to the repository once `apps/web` exists.
2. Use `apps/web` as the project root if the monorepo configuration requires it.
3. In **Project Settings > Environment Variables**, add every Vercel-targeted variable from the master inventory.
4. Assign distinct values to Development, Preview, and Production.
5. Set `APP_BASE_URL` and `NEXT_PUBLIC_APP_URL` to the correct origin for each stable environment.
6. Deploy once, then use the resulting HTTPS origin to finish Google OAuth callbacks, Better Auth origin configuration, QStash callbacks, and OneSignal web setup.
7. When a third-party webhook must call a protected Preview deployment, create a dedicated Protection Bypass for Automation in **Project Settings > Deployment Protection** and keep the generated value out of source code, logs, and chat. That bypass works across the project's deployments until revoked; disabling Vercel Authentication instead makes every existing Preview deployment public and requires an explicit security decision.
8. After changing any Vercel variable, create a new deployment; old deployments keep their old values.
9. For local work, pull only the Development environment into a gitignored file with `vercel env pull` or run commands with `vercel env run`.

### Rename and domain checklist

- Renaming the Vercel project can change generated `vercel.app` URLs.
- Adding or changing a custom domain requires updates in Better Auth, Google OAuth, OneSignal web push, QStash callback targets, `APP_BASE_URL`, `NEXT_PUBLIC_APP_URL`, and `EXPO_PUBLIC_API_URL`.
- `VERCEL_PROJECT_PRODUCTION_URL` is supplied by Vercel, but it has no `https://` prefix. Use the explicit `APP_BASE_URL` contract for signed callbacks and external links.

Official references: [Vercel environment variables](https://vercel.com/docs/environment-variables), [managing Vercel variables](https://vercel.com/docs/environment-variables/managing-environment-variables), [Vercel environment CLI](https://vercel.com/docs/cli/env).

## 5. Upstash QStash

### Why it exists

QStash calls the API later: deadline transitions, reminders, and the weekly catalog-refresh reminder. It never writes to Neon directly.

### Setup

1. Create an Upstash account and open QStash.
2. Copy the QStash API token into `QSTASH_TOKEN` in Vercel.
3. Copy the current and next signing keys into `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY`.
4. Implement public callback routes under `APP_BASE_URL`.
5. Verify every incoming `Upstash-Signature` using both signing keys.
6. Use the token only on the server to publish delayed messages and schedules.
7. Test callbacks against Preview before enabling production schedules.
8. For fully local testing, use the QStash development server and its displayed `QSTASH_URL` and test credentials; never use those local values in production.

### Rename and rotation checklist

- A domain change affects every scheduled destination URL. Recreate or update schedules after changing `APP_BASE_URL`.
- Rotating the QStash token immediately affects publishing; update `QSTASH_TOKEN` first.
- Keep both signing-key variables because QStash uses the next key during safe rotation.

Official references: [QStash security](https://upstash.com/docs/qstash/features/security), [QStash receiver verification](https://upstash.com/docs/qstash/sdks/ts/examples/receiver), [QStash local development](https://upstash.com/docs/qstash/howto/local-development).

## 6. OneSignal Notifications

### Why it exists

OneSignal delivers Android native push and iPhone PWA web push. The database still records the authoritative in-app notification history.

### Setup

1. Create a OneSignal application named `ordah please`.
2. Add an Android platform whose package matches `ANDROID_APPLICATION_ID` exactly.
3. Configure Firebase Cloud Messaging credentials directly in the OneSignal dashboard. Do not commit or document the credential file.
4. Add the OneSignal Expo plugin first in the Expo plugins list and install the React Native OneSignal SDK.
5. Put the public OneSignal App ID in `EXPO_PUBLIC_ONESIGNAL_APP_ID`.
6. Configure the Web platform with the exact `NEXT_PUBLIC_APP_URL` origin.
7. Host `OneSignalSDKWorker.js` on the same HTTPS origin. For the PWA, use a stable dedicated path such as `/push/onesignal/OneSignalSDKWorker.js` to reduce conflict with the PWA service worker.
8. Put the public App ID in `NEXT_PUBLIC_ONESIGNAL_APP_ID`.
9. Create an App API Key and store it only as `ONESIGNAL_APP_API_KEY` in Vercel.
10. After Better Auth sign-in maps to an internal Neon product user, call OneSignal login with that stable internal user ID as the External ID. Do not use a mutable email address.
11. Ask for notification permission only from a clear user action. On iPhone, explain that web push requires an installed Home Screen PWA on supported iOS versions.

### Rename and rotation checklist

- Renaming only the OneSignal dashboard application is cosmetic.
- Recreating the OneSignal application changes the App ID and API key; update all three OneSignal variables.
- Changing `ANDROID_APPLICATION_ID` requires reconfiguring the Android platform and FCM relationship.
- Changing the web domain requires a OneSignal web-origin update and users may need to subscribe again on the new origin.
- Rotating the App API Key requires updating `ONESIGNAL_APP_API_KEY` and redeploying before sending notifications.

Official references: [OneSignal keys and IDs](https://documentation.onesignal.com/docs/en/keys-and-ids), [OneSignal Expo setup](https://documentation.onesignal.com/docs/en/react-native-expo-sdk-setup), [OneSignal web setup](https://documentation.onesignal.com/docs/en/web-sdk-setup), [OneSignal user identity](https://documentation.onesignal.com/docs/en/users).

## 7. Expo and EAS

### Why it exists

Expo provides the Android application framework. EAS produces private development and preview APK builds and stores build-time configuration by environment.

### Setup

1. Create or select the Expo account represented by `EXPO_OWNER` when an explicit owner is needed.
2. Initialize the Expo/EAS project with slug `ordah-please`.
3. Record the generated EAS project UUID as `EAS_PROJECT_ID`.
4. Configure Expo from the canonical identity variables:
   - name from `APP_DISPLAY_NAME`
   - slug from `APP_SLUG`
   - scheme from `APP_SCHEME`
   - Android package from `ANDROID_APPLICATION_ID`
5. Define EAS `development`, `preview`, and `production` environments.
6. Add the public mobile variables: `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_ONESIGNAL_APP_ID`. Better Auth and Google secrets remain server-only and never enter EAS.
7. Add the build-identity variables from the master inventory.
8. Do not put server secrets into EAS or any `EXPO_PUBLIC_` variable.
9. Use a development build for OneSignal testing; native OneSignal modules do not work in Expo Go.
10. List each environment before building and confirm its API origin and public provider IDs point to the matching environment.

### Rename checklist

- Changing the visible name affects `APP_DISPLAY_NAME` and can be delivered in a new build.
- Changing the slug affects project/config references but is different from changing the Android package.
- Changing `ANDROID_APPLICATION_ID` creates a different installed Android application and requires new provider registrations.
- Changing any `EXPO_PUBLIC_` value requires rebuilding or republishing the client bundle; it is embedded during bundling.

Official references: [Expo environment variables](https://docs.expo.dev/guides/environment-variables/), [EAS environment management](https://docs.expo.dev/eas/environment-variables/manage/), [EAS build configuration](https://docs.expo.dev/build-reference/build-configuration/).

## 8. Local Development Rules

When implementation begins, use variable-name-only template files and gitignored real-value files:

```text
.env.example                 # Names and safe descriptions only; committed
apps/web/.env.local          # Real local web/server values; never committed
apps/mobile/.env.local       # Real local public mobile values; never committed
```

The future `.env.example` may list names like this, but must not contain usable values:

```dotenv
APP_DISPLAY_NAME=<public display name>
APP_SLUG=<technical slug>
ANDROID_APPLICATION_ID=<android package id>
APP_SCHEME=<mobile callback scheme>
APP_BASE_URL=<server origin>
NEXT_PUBLIC_APP_URL=<public web origin>
EXPO_PUBLIC_API_URL=<public api origin>
DATABASE_URL=<server secret>
DATABASE_MIGRATION_URL=<migration-only secret>
DATABASE_SEED_CONFIRMATION=<development-only non-secret confirmation>
DATABASE_IDENTITY_LINK_CONFIRMATION=<development-only non-secret confirmation>
BETTER_AUTH_SECRET=<server secret>
BETTER_AUTH_URL=<server origin>
GOOGLE_CLIENT_ID=<server configuration>
GOOGLE_CLIENT_SECRET=<server secret>
R2_ACCOUNT_ID=<server configuration>
R2_BUCKET_NAME=<server configuration>
R2_ENDPOINT=<server configuration>
R2_ACCESS_KEY_ID=<server secret>
R2_SECRET_ACCESS_KEY=<server secret>
NEXT_PUBLIC_ONESIGNAL_APP_ID=<public identifier>
EXPO_PUBLIC_ONESIGNAL_APP_ID=<public identifier>
ONESIGNAL_APP_API_KEY=<server secret>
QSTASH_TOKEN=<server secret>
QSTASH_CURRENT_SIGNING_KEY=<server secret>
QSTASH_NEXT_SIGNING_KEY=<server secret>
EAS_PROJECT_ID=<public project identifier>
EXPO_OWNER=<public account name>
```

## 9. Change Tracking Checklist

Before changing a name, domain, identifier, provider project, bucket, or key:

1. Find the variable in the master inventory.
2. Identify every environment that uses it.
3. Change the provider dashboard first when the provider owns the value.
4. Update Vercel and/or EAS without writing the value into the repository.
5. Redeploy the web/API when a Vercel value changes.
6. Rebuild the Android app when an Expo public or build-identity value changes.
7. Recheck Better Auth trusted origins, Google callbacks, QStash destinations, and OneSignal origins after a domain change.
8. Test Development, then Preview, then Production.
9. Rotate or revoke the old secret only after the new value works.
10. Update this file if a variable is added, removed, renamed, or changes ownership.

## 10. Minimum Setup Verification

- Web and Android sign in through the matching Better Auth environment and Google OAuth client.
- The API connects to Neon using `DATABASE_URL`; migrations use only `DATABASE_MIGRATION_URL`.
- The browser and Android clients cannot read any server-secret variable.
- A signed R2 upload URL writes only to the intended private bucket and prefix.
- A QStash callback rejects an invalid signature and accepts a valid one once.
- Android and installed iPhone PWA test subscriptions map to the same stable internal External ID in OneSignal.
- A preview deployment never uses production database, storage, auth, notification, or scheduling credentials.
- No `.env`, credential JSON, private key, token, or connection string is committed.

## 11. Limits and Billing Guardrails

`context/service-limits.md` records the current free allowances, reset periods, failure behavior, automatic-billing risk, internal warning thresholds, dashboards, and explicit upgrade triggers for every approved V1 service.

Crossing a warning threshold does not authorize a paid upgrade. No agent may add a payment method, enable usage-based billing, accept overage terms, or upgrade a plan without explicit user approval.

## Plain-Language Technology Reference

The setup sections above describe *how to configure* each service. This section explains *what each technology is* in plain language, for readers new to the stack. Items that already have a setup section above are explained here at the concept level only; items that have no setup section (because they are open-source libraries or developer tools rather than configurable services) are documented here in full.

### The mental model

A modern web and mobile app has three layers:

- **Client** — what runs on the user's phone or browser: the buttons, screens, and animations.
- **Server** — a program running on a remote computer that holds the real truth and decides what each user is allowed to do.
- **Database** — the permanent memory where records live (users, orders, restaurants).

This repository is a **monorepo**: one repository holding several sub-projects (`apps/web`, `apps/mobile`, and several shared `packages/`) so all clients and the server can share code.

### Foundational language and runtime

- **TypeScript** — JavaScript with type annotations so mistakes (passing a string where a number is expected) get caught before code runs. The entire codebase is TypeScript.
- **Node.js** — A runtime that lets JavaScript run outside a browser: on a server, or on a laptop during development.
- **npm** — The package manager that downloads third-party libraries and runs workspace scripts.

### Frontend (what users see)

- **React** — A library (from Meta) for building UIs out of reusable components. Each component is a function that returns what should appear on screen; React figures out the minimal redraw when data changes.
- **Next.js** — A framework (from Vercel) built on React that adds routing, server-side rendering, API endpoints, and a build pipeline. Powers `apps/web`.
- **React Native** — A version of React (from Meta) that compiles React components into real native iOS and Android UI rather than HTML.
- **Expo** — A toolkit that wraps React Native to make builds easier; it handles native compilation so we avoid wrestling with Android Studio and Xcode directly. **EAS** (Expo Application Services) is Expo's cloud build system that compiles the app into an installable APK.
- **PWA (Progressive Web App)** — A website that is installable on a phone home screen and can receive push notifications like a native app. On iPhone, where sideloading is not possible, the "app" is this PWA built with Next.js.
- **lucide-react / lucide-react-native** — Open-source icon sets; one variant for web, one for mobile.
- **react-native-paper** — Material-Design-styled component library for React Native.
- **@fontsource-variable/nunito-sans / @expo-google-fonts/nunito-sans** — Self-hosted copies of the Nunito Sans font so the apps do not depend on Google Fonts at runtime.

### Database layer

- **PostgreSQL** ("Postgres") — A relational database. Data lives in tables (users, orders, restaurants) with strict columns and relationships between tables. Open source, around 30 years old, the most battle-tested database in the industry. Queried using SQL.
- **Neon** — A hosted PostgreSQL service. Instead of installing Postgres on a server, we get a connection string. Neon's distinctive feature is serverless Postgres that can scale to zero, which fits the free-tier prototype target. See the Neon setup section above for configuration.
- **ORM (Object-Relational Mapper)** — A bridge between SQL and TypeScript. You write code such as `db.select().from(users)` and the ORM translates that into SQL, sends it, and returns typed TypeScript objects. The two benefits are type safety (the compiler knows the shape of the data) and database portability (code is not tied to one vendor's SQL dialect).
- **Drizzle ORM** — The specific ORM we use. Unlike older ORMs that hide SQL behind their own query language, Drizzle mirrors SQL in TypeScript so you can always see the query that will run. Lightweight, fast, and very type-safe.
- **Drizzle Kit** — The companion CLI. When the database shape changes (new column, renamed table), Drizzle Kit generates a migration file describing the change so the live database can be upgraded without losing data.
- **pg** — The low-level Node.js driver that opens the TCP connection to Postgres. Drizzle uses it under the hood.
- **Connection pooling** — A database connection is expensive to open. A pooler keeps warm connections ready and hands them out per request. Neon provides a pooled connection string so serverless platforms (which spin up a new function per request) do not overwhelm the database. This is why we have separate `DATABASE_URL` (pooled, runtime) and `DATABASE_MIGRATION_URL` (direct, for schema changes).

### Authentication concepts

- **OAuth 2.0** — An open standard protocol for "sign in with X." Lets a user prove identity with one provider (Google) without sharing their password with our app.
- **Google OAuth** — Google's implementation. Google proves the person controls a given Gmail account once, at sign-in time.
- **Better Auth** — An open-source, self-hosted authentication framework. Google only proves identity once; Better Auth creates and verifies the session ("you are logged in for the next 7 days") that persists across requests. It runs inside our Next.js server and stores sessions in Neon. Used instead of a hosted service like Clerk to keep cost at USD 0.
- **@better-auth/drizzle-adapter / @better-auth/expo** — Plugs Better Auth into Drizzle and into the Expo Android app respectively.
- **Firebase Cloud Messaging (FCM)** — Google's free service that ferries push notifications to Android devices. OneSignal uses FCM under the hood; we never talk to FCM directly.

### Build, test, and code-quality tooling

These are developer-only dependencies; they do not ship to users.

- **Vitest** — Modern unit-test framework for web and shared packages.
- **Jest** — Older unit-test framework, used by the mobile app because React Native tooling still centers on it.
- **Playwright** — End-to-end test framework that drives a real browser through the actual app to verify whole flows.
- **ESLint** — Static code linter that catches bugs and style issues.
- **Prettier** — Auto-formatter so everyone's code looks the same.
- **tsx** — Runs TypeScript files directly without a separate compile step; used for one-off scripts like seeding the dev database.
- **@testing-library/react-native** — Helpers for testing React Native components.

### External collection and handoff

- **Codex Computer Use** — An AI tool an admin uses externally to read menus off Grab's website and turn them into JSON or CSV files. A human reviews the files before import. Not part of the running app.
- **Grab** — The food delivery app. This product does not order from Grab automatically; it compiles the final order text so an organizer can paste it into Grab manually.

### Recurring patterns

Two patterns are worth recognizing because they repeat across the stack:

- **Library vs. framework** — A library is code you call (React, Drizzle). A framework is code that calls you, imposing structure (Next.js, Expo). Frameworks are larger commitments.
- **Self-hosted vs. managed** — Most of the stack above is a hosted service (Neon, R2, QStash, OneSignal, Vercel) wrapping an open-source idea (Postgres, S3, queues, push, web servers). We pay the vendor to run it so we do not operate servers. Better Auth is the deliberate exception — it is self-hosted to avoid a per-user auth bill.

## Retired Services

Clerk is retired by V1-04A. Do not add Clerk variables, runtime packages, webhooks, or active setup instructions. Historical generated migrations and progress evidence may retain Clerk terminology because they describe the system that existed before this migration.
