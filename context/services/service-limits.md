# V1 Service Limits and Upgrade Guardrails

Last verified: 2026-07-29

## Operating Rule

Crossing a warning threshold does not authorize a paid upgrade.

No agent may add a payment method, enable usage-based billing, accept an overage plan, or upgrade a service without explicit user approval.

Warning thresholds are internal review points, not provider guarantees. Provider dashboards and the linked official sources remain authoritative because allowances can change.

## Better Auth Framework

| Field | Value |
| --- | --- |
| Service and plan | Self-hosted Better Auth framework |
| Why it exists | Creates and verifies Google-backed application sessions |
| Free allowance | Framework use has no hosted-service quota; compute and storage consume the Vercel and Neon allowances below |
| Reset period | Not applicable |
| Hard limit | Vercel, Neon, cookie, and application limits apply |
| At the limit | Authentication can fail if its host or database is unavailable |
| Automatic billing possible | No from the framework itself |
| Payment method required | No |
| Internal warning threshold | Review when either Neon or Vercel reaches 70% of its warning threshold |
| Dashboard | No Better Auth dashboard is required; use Vercel and Neon dashboards |
| Explicit upgrade trigger | Only after measured host or database usage cannot be reduced safely |
| Official source | [Better Auth pricing](https://better-auth.com/pricing), [database model](https://better-auth.com/docs/concepts/database) |

Better Auth Infrastructure is not used. Its dashboard, managed audit-log, detection, messaging, and enterprise allowances do not apply.

## Google OAuth

| Field | Value |
| --- | --- |
| Service and plan | Google OAuth Platform, External audience, Testing |
| Why it exists | Proves control of a Google identity |
| Free allowance | Basic identity scopes `openid`, `email`, and `profile`; Testing normally has a 100-test-user cap, but Google documents an exception when only basic identity scopes are requested |
| Reset period | No periodic reset for the user cap |
| Hard limit | Scope, client, redirect-URI, and publishing-state policy |
| At the limit | Authorization is rejected until the OAuth configuration is corrected |
| Automatic billing possible | No for this basic sign-in flow |
| Payment method required | No |
| Internal warning threshold | Keep scopes fixed to the three basic identity scopes and fewer than 30 private users |
| Dashboard | Google Cloud Console > Google Auth Platform |
| Explicit upgrade trigger | None for V1; broader scopes or public distribution require a new security and verification review |
| Official source | [OAuth app state overview](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview), [OAuth policies](https://developers.google.com/identity/protocols/oauth2/policies) |

## Neon

| Field | Value |
| --- | --- |
| Service and plan | Neon Free |
| Why it exists | Stores Better Auth sessions and structured product truth |
| Free allowance | Per project: 100 CU-hours/month, 0.5 GB storage, up to 2 CU, and 5 GB public network transfer/month; current account limits may also cap projects and branches |
| Reset period | Monthly for compute and transfer |
| Hard limit | Free-plan compute, storage, transfer, project, and branch quotas |
| At the limit | Compute or storage access can be suspended or constrained until reset, cleanup, or an approved upgrade |
| Automatic billing possible | No while the project remains on Free |
| Payment method required | No |
| Internal warning threshold | 70 CU-hours, 350 MB storage, or 3.5 GB transfer per project |
| Dashboard | Neon Console > Project > Monitoring and Billing |
| Explicit upgrade trigger | Sustained usage above 70% after query, retention, and storage cleanup |
| Official source | [Neon pricing](https://neon.com/pricing), [Neon free-plan guidance](https://neon.com/blog/how-to-make-the-most-of-neons-free-plan) |

## Vercel

| Field | Value |
| --- | --- |
| Service and plan | Vercel Hobby |
| Why it exists | Hosts the Next.js PWA, Better Auth, and trusted API |
| Free allowance | 4 active CPU-hours, 360 GB-hours provisioned memory, 1,000,000 function invocations, 100 GB-hours function duration, 1,000,000 edge requests, and plan-specific build/deployment limits |
| Reset period | Generally a rolling 30-day period; some features differ |
| Hard limit | Hobby usage and fair-use limits; personal, non-commercial use only |
| At the limit | The affected feature generally stops until its window resets |
| Automatic billing possible | No on Hobby |
| Payment method required | No |
| Internal warning threshold | 2.8 CPU-hours, 252 GB-hours memory, 700,000 invocations, or 700,000 edge requests |
| Dashboard | Vercel project or team > Usage |
| Explicit upgrade trigger | Sustained private-group usage above 70% after caching, query, and function optimization |
| Official source | [Vercel Hobby plan](https://vercel.com/docs/plans/hobby), [Vercel limits](https://vercel.com/docs/limits) |

## Cloudflare R2

| Field | Value |
| --- | --- |
| Service and plan | Cloudflare R2 Standard storage |
| Why it exists | Stores private thumbnails, imports, validation reports, and receipts |
| Free allowance | 10 GB-month storage, 1 million Class A operations/month, 10 million Class B operations/month, and free Internet egress |
| Reset period | Monthly; storage is averaged as GB-month |
| Hard limit | Object and account platform limits; the listed amounts are pricing allowances, not hard stops |
| At the limit | Usage above the free allowance is billable when billing is enabled |
| Automatic billing possible | Yes if the account has billing enabled |
| Payment method required | Cloudflare may require billing setup to use R2; verify the account before creating a bucket |
| Internal warning threshold | 7 GB-month, 700,000 Class A operations, or 7 million Class B operations |
| Dashboard | Cloudflare > Storage & Databases > R2 > Metrics |
| Explicit upgrade trigger | None; reduce storage/operations or request explicit billing approval before exceeding 70% |
| Official source | [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [R2 limits](https://developers.cloudflare.com/r2/platform/limits/) |

## Upstash QStash

| Field | Value |
| --- | --- |
| Service and plan | QStash Free |
| Why it exists | Delivers deadline callbacks and supervised refresh reminders |
| Free allowance | 1,000 delivery attempts/day, 50 GB bandwidth, 1 MB messages, 10 active schedules, 7-day maximum delay, and 3-day DLQ/log retention |
| Reset period | Daily for messages; bandwidth uses the provider's plan period |
| Hard limit | Message size, schedule count, delay, retention, and parallelism limits |
| At the limit | Persistent overage may be throttled with HTTP 429; each retry counts as another message |
| Automatic billing possible | No on Free; pay-as-you-go is a separate opt-in plan |
| Payment method required | No |
| Internal warning threshold | 700 delivery attempts/day, 7 active schedules, or 35 GB bandwidth |
| Dashboard | Upstash Console > QStash > Usage |
| Explicit upgrade trigger | Sustained legitimate traffic above 70% after retry and schedule optimization |
| Official source | [QStash pricing](https://upstash.com/pricing/qstash) |

## OneSignal

| Field | Value |
| --- | --- |
| Service and plan | OneSignal Free |
| Why it exists | Delivers Android and installed-iPhone-PWA push notifications |
| Free allowance | Unlimited mobile push sends; web push is limited to 10,000 subscribers per send; one active in-app message; contacts and API send access are listed as unlimited |
| Reset period | Monthly where a monthly allowance applies |
| Hard limit | Free-plan feature and per-send audience limits |
| At the limit | A send or premium feature is unavailable until usage/configuration is reduced or a paid plan is explicitly approved |
| Automatic billing possible | No on Free |
| Payment method required | No |
| Internal warning threshold | 7,000 web subscribers per send or 70% of any dashboard-displayed message allowance |
| Dashboard | OneSignal > Organization/App > Billing and Usage |
| Explicit upgrade trigger | A verified required audience cannot be served within Free after segmentation and cleanup |
| Official source | [OneSignal pricing](https://onesignal.com/pricing), [OneSignal billing FAQ](https://documentation.onesignal.com/docs/en/billing-faq) |

## Expo EAS

| Field | Value |
| --- | --- |
| Service and plan | Expo EAS Free |
| Why it exists | Produces private Android builds and serves eligible EAS Updates |
| Free allowance | A limited monthly quantity of low-priority builds and 1,000 EAS Update monthly active users; Expo directs users to the live pricing/dashboard for the current build quota |
| Reset period | First day of each calendar month |
| Hard limit | Free build/update quota and lower build-resource limits |
| At the limit | Further free builds or updates stop until reset or an explicitly approved plan upgrade |
| Automatic billing possible | No on Free; paid plans can use usage-based billing |
| Payment method required | No |
| Internal warning threshold | 50% of the live build quota and 700 EAS Update monthly active users |
| Dashboard | Expo account > Billing > Usage and project > Builds |
| Explicit upgrade trigger | Release-blocking build demand remains after local exports and build reuse |
| Official source | [EAS plans](https://docs.expo.dev/billing/plans/), [EAS billing FAQ](https://docs.expo.dev/billing/faq/), [Expo pricing](https://expo.dev/pricing) |

## GitHub Actions

| Field | Value |
| --- | --- |
| Service and plan | GitHub Free |
| Why it exists | Runs provider-free continuous integration |
| Free allowance | Private repositories: 2,000 standard-runner minutes/month, 500 MB shared artifact/package storage, and 10 GB cache per repository; public standard-runner usage is free |
| Reset period | Minutes reset monthly; storage accrues hourly within the billing cycle |
| Hard limit | Included minutes and storage when no valid payment method exists |
| At the limit | Actions usage is blocked when no payment method is configured; with billing and budgets, overage can be charged |
| Automatic billing possible | Yes if a valid payment method and permissive budget exist |
| Payment method required | No for included Free usage |
| Internal warning threshold | 1,400 private-repository minutes or 350 MB artifact/package storage |
| Dashboard | GitHub account or organization > Billing and licensing > Usage |
| Explicit upgrade trigger | Required CI cannot fit after caching, cancellation, and provider-test separation |
| Official source | [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) |

## Retired Service

Clerk is retired by V1-04A. Its limits, dashboard, keys, webhook, and billing are not part of the active architecture. Historical records may name Clerk to preserve truthful implementation history.
