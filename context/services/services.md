# Services

External services approved for V1 and the contribution each makes to the project.

## Active Services

| Service | Contribution |
| --- | --- |
| Google OAuth | Proves control of a Google identity at sign-in |
| Better Auth (self-hosted) | Creates and verifies application sessions; stores them in Neon |
| Vercel | Hosts the Next.js PWA, admin portal, and trusted API boundary; stores server runtime variables |
| Neon PostgreSQL | Stores structured product truth: users, roles, groups, catalog, favorites, orders, history, and audit events |
| Cloudflare R2 | Stores private file bytes: thumbnails, imports, validation reports, and receipts |
| Upstash QStash | Schedules delayed deadline transitions, reminders, and the weekly catalog-refresh callback |
| OneSignal | Delivers Android native push and iPhone PWA web push |
| Expo EAS | Produces private Android development, preview, and production APK builds |
| GitHub Actions | Runs provider-free continuous integration |
| Codex Computer Use | External supervised tool for reading menus off Grab and producing reviewed JSON/CSV imports |
| Grab | External handoff target; the organizer pastes the compiled order manually. Not integrated automatically |

## Retired Services

Clerk is retired by V1-04A and is not part of the active architecture.

## Related Files

- `service-setup.md` — configuration steps, variable names, environment placement, and rename/rotation checklists
- `service-limits.md` — free-tier allowances, warning thresholds, and explicit upgrade triggers
- `technology-reference.md` — plain-language explanation of each technology in the stack
