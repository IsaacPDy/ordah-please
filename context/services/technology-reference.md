# Plain-Language Technology Reference

This file explains *what each technology is* in plain language, for readers new to the stack. It does not cover configuration; for configuration, variable names, and rename procedures, see `service-setup.md`.

Items that have a setup section in `service-setup.md` are explained here at the concept level only. Items that have no setup section (because they are open-source libraries or developer tools rather than configurable services) are documented here in full.

## The mental model

A modern web and mobile app has three layers:

- **Client** — what runs on the user's phone or browser: the buttons, screens, and animations.
- **Server** — a program running on a remote computer that holds the real truth and decides what each user is allowed to do.
- **Database** — the permanent memory where records live (users, orders, restaurants).

This repository is a **monorepo**: one repository holding several sub-projects (`apps/web`, `apps/mobile`, and several shared `packages/`) so all clients and the server can share code.

## Foundational language and runtime

- **TypeScript** — JavaScript with type annotations so mistakes (passing a string where a number is expected) get caught before code runs. The entire codebase is TypeScript.
- **Node.js** — A runtime that lets JavaScript run outside a browser: on a server, or on a laptop during development.
- **npm** — The package manager that downloads third-party libraries and runs workspace scripts.

## Frontend (what users see)

- **React** — A library (from Meta) for building UIs out of reusable components. Each component is a function that returns what should appear on screen; React figures out the minimal redraw when data changes.
- **Next.js** — A framework (from Vercel) built on React that adds routing, server-side rendering, API endpoints, and a build pipeline. Powers `apps/web`.
- **React Native** — A version of React (from Meta) that compiles React components into real native iOS and Android UI rather than HTML.
- **Expo** — A toolkit that wraps React Native to make builds easier; it handles native compilation so we avoid wrestling with Android Studio and Xcode directly. **EAS** (Expo Application Services) is Expo's cloud build system that compiles the app into an installable APK.
- **PWA (Progressive Web App)** — A website that is installable on a phone home screen and can receive push notifications like a native app. On iPhone, where sideloading is not possible, the "app" is this PWA built with Next.js.
- **lucide-react / lucide-react-native** — Open-source icon sets; one variant for web, one for mobile.
- **react-native-paper** — Material-Design-styled component library for React Native.
- **@fontsource-variable/nunito-sans / @expo-google-fonts/nunito-sans** — Self-hosted copies of the Nunito Sans font so the apps do not depend on Google Fonts at runtime.

## Database layer

- **PostgreSQL** ("Postgres") — A relational database. Data lives in tables (users, orders, restaurants) with strict columns and relationships between tables. Open source, around 30 years old, the most battle-tested database in the industry. Queried using SQL.
- **Neon** — A hosted PostgreSQL service. Instead of installing Postgres on a server, we get a connection string. Neon's distinctive feature is serverless Postgres that can scale to zero, which fits the free-tier prototype target. See the Neon setup section in `service-setup.md` for configuration.
- **ORM (Object-Relational Mapper)** — A bridge between SQL and TypeScript. You write code such as `db.select().from(users)` and the ORM translates that into SQL, sends it, and returns typed TypeScript objects. The two benefits are type safety (the compiler knows the shape of the data) and database portability (code is not tied to one vendor's SQL dialect).
- **Drizzle ORM** — The specific ORM we use. Unlike older ORMs that hide SQL behind their own query language, Drizzle mirrors SQL in TypeScript so you can always see the query that will run. Lightweight, fast, and very type-safe.
- **Drizzle Kit** — The companion CLI. When the database shape changes (new column, renamed table), Drizzle Kit generates a migration file describing the change so the live database can be upgraded without losing data.
- **pg** — The low-level Node.js driver that opens the TCP connection to Postgres. Drizzle uses it under the hood.
- **Connection pooling** — A database connection is expensive to open. A pooler keeps warm connections ready and hands them out per request. Neon provides a pooled connection string so serverless platforms (which spin up a new function per request) do not overwhelm the database. This is why we have separate `DATABASE_URL` (pooled, runtime) and `DATABASE_MIGRATION_URL` (direct, for schema changes).

## Authentication concepts

- **OAuth 2.0** — An open standard protocol for "sign in with X." Lets a user prove identity with one provider (Google) without sharing their password with our app.
- **Google OAuth** — Google's implementation. Google proves the person controls a given Gmail account once, at sign-in time.
- **Better Auth** — An open-source, self-hosted authentication framework. Google only proves identity once; Better Auth creates and verifies the session ("you are logged in for the next 7 days") that persists across requests. It runs inside our Next.js server and stores sessions in Neon. Used instead of a hosted service like Clerk to keep cost at USD 0.
- **@better-auth/drizzle-adapter / @better-auth/expo** — Plugs Better Auth into Drizzle and into the Expo Android app respectively.
- **Firebase Cloud Messaging (FCM)** — Google's free service that ferries push notifications to Android devices. OneSignal uses FCM under the hood; we never talk to FCM directly.

## Build, test, and code-quality tooling

These are developer-only dependencies; they do not ship to users.

- **Vitest** — Modern unit-test framework for web and shared packages.
- **Jest** — Older unit-test framework, used by the mobile app because React Native tooling still centers on it.
- **Playwright** — End-to-end test framework that drives a real browser through the actual app to verify whole flows.
- **ESLint** — Static code linter that catches bugs and style issues.
- **Prettier** — Auto-formatter so everyone's code looks the same.
- **tsx** — Runs TypeScript files directly without a separate compile step; used for one-off scripts like seeding the dev database.
- **@testing-library/react-native** — Helpers for testing React Native components.

## External collection and handoff

- **Codex Computer Use** — An AI tool an admin uses externally to read menus off Grab's website and turn them into JSON or CSV files. A human reviews the files before import. Not part of the running app.
- **Grab** — The food delivery app. This product does not order from Grab automatically; it compiles the final order text so a Manager or Group Owner can paste it into Grab manually.

## Recurring patterns

Two patterns are worth recognizing because they repeat across the stack:

- **Library vs. framework** — A library is code you call (React, Drizzle). A framework is code that calls you, imposing structure (Next.js, Expo). Frameworks are larger commitments.
- **Self-hosted vs. managed** — Most of the stack above is a hosted service (Neon, R2, QStash, OneSignal, Vercel) wrapping an open-source idea (Postgres, S3, queues, push, web servers). We pay the vendor to run it so we do not operate servers. Better Auth is the deliberate exception — it is self-hosted to avoid a per-user auth bill.
