# Integrations

## Integration Snapshot

The active application surface is centered on PostgreSQL, Redis, Stripe, Google OAuth/Calendar, LinkedIn OAuth, Zoom, Gmail OAuth2 SMTP, Supabase Storage, and Anthropic. Deployment assumptions are Vercel for the web app plus a separate BullMQ worker process, with optional local Supabase CLI scaffolding kept in `supabase/config.toml`.

## Live Infrastructure Dependencies

| Dependency | Evidence | What Depends On It | Env / Config Touchpoints |
| --- | --- | --- | --- |
| PostgreSQL | `prisma/schema.prisma`, `lib/core/db.ts`, `prisma/migrations/*` | All domain data, auth state, bookings, payments, reviews, disputes, audit logs, and external-id persistence. | `STORAGE_POSTGRES_PRISMA_URL` in `prisma/schema.prisma`; optional `STORAGE_POSTGRES_URL_NON_POOLING` in `scripts/vercel-build.sh`. |
| Redis | `lib/queues/index.ts`, `scripts/dev-queue.ts`, `lib/queues/**/*.ts` | BullMQ queues/workers for QC, notifications, payments, and bookings. | `REDIS_URL` in `lib/queues/index.ts`, `.env.example`, `README.md`. |
| Vercel | `vercel.json`, `scripts/vercel-build.sh`, `README.md` | Build/deploy target and cron trigger source. | `vercel.json` cron definitions; `VERCEL_ENV` in `scripts/vercel-build.sh`; optional `CRON_SECRET` enforced by `lib/core/cron-auth.ts`. |
| Docker Compose | `docker-compose.yml` | Local PostgreSQL 15 + Redis 7 dev stack. | No extra env indirection beyond container defaults in `docker-compose.yml`. |
| Supabase CLI stack | `supabase/config.toml`, `README.md` | Optional local Supabase services for Postgres/storage experimentation. | `supabase/config.toml` plus mappings described in `README.md`. |

## Auth And Identity Providers

| Provider / Mechanism | Evidence | Scope | Notes |
| --- | --- | --- | --- |
| NextAuth session/auth shell | `src/auth.ts`, `src/proxy.ts`, `src/app/api/auth/[...nextauth]/route.ts` | Main auth/session framework | Uses JWT session strategy and protects role-prefixed routes in `src/proxy.ts`. |
| Credentials auth | `src/auth.ts`, `lib/domain/auth/services.ts`, `prisma/schema.prisma` | Email/password sign-in | Password verification uses `bcryptjs`; reset tokens persist in `PasswordResetToken`. |
| Google OAuth | `src/auth.ts`, `lib/domain/auth/oauth-service.ts`, `prisma/schema.prisma` | Sign-in plus Calendar scopes | Requests `calendar.readonly` and `calendar.events`; tokens persist in `OAuthAccount`. |
| LinkedIn OAuth | `src/auth.ts`, `lib/domain/auth/oauth-service.ts`, `src/components/auth/ProviderConnections.tsx` | Sign-in/account-linking | OAuth is active for auth/account linking, but no separate LinkedIn API client usage was found beyond provider connectivity. |
| Corporate email verification | `lib/domain/users/verification-service.ts`, `src/app/api/shared/verification/*`, `prisma/schema.prisma` | Professional onboarding/settings verification | Verification emails flow through the Gmail-backed email transport. |

### Auth env touchpoints

| Variable | Where Used | Comments |
| --- | --- | --- |
| `AUTH_SECRET`, `NEXTAUTH_SECRET` | `src/auth.ts`, `src/proxy.ts` | Required for NextAuth and token reads. |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | `src/auth.ts`, `lib/integrations/calendar/google.ts` | Primary Google OAuth envs. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `src/auth.ts`, `lib/integrations/calendar/google.ts` | Backward-compatible aliases. |
| `AUTH_LINKEDIN_ID`, `AUTH_LINKEDIN_SECRET` | `src/auth.ts` | Primary LinkedIn OAuth envs. |
| `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | `src/auth.ts` | Backward-compatible aliases. |
| `NEXTAUTH_URL` | `lib/integrations/calendar/google.ts`, `src/app/api/auth/callback-redirect/route.ts` | Active in code, but not documented in `.env.example`. |

## External APIs And Service Adapters

| Service | Evidence | What The App Does | Env / Config Touchpoints |
| --- | --- | --- | --- |
| Stripe Payments + Connect | `lib/integrations/stripe/index.ts`, `src/app/api/shared/stripe/webhook/route.ts`, `lib/domain/payments/services.ts`, `lib/domain/users/onboarding-service.ts` | Creates PaymentIntents, captures/cancels/refunds payments, provisions Connect accounts, creates account links, transfers payouts, and handles Stripe webhooks. | `STRIPE_SECRET_KEY`, `STRIPE_TEST_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_TEST_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. |
| Zoom | `lib/integrations/zoom.ts`, `lib/integrations/zoom-attendance.ts`, `src/app/api/shared/zoom/webhook/route.ts` | Obtains server-to-server OAuth tokens, creates/reads meetings and registrants, fetches invitation text, verifies webhooks, and tracks attendance events. | `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_WEBHOOK_SECRET_TOKEN`, attendance tuning vars. |
| Google Calendar API | `lib/integrations/calendar/google.ts`, `src/components/bookings/hooks/useCandidateGoogleBusy.ts` | Reads free/busy data from a connected user's Google Calendar using stored OAuth tokens. | Google OAuth vars plus `NEXTAUTH_URL`. |
| Gmail OAuth2 SMTP | `lib/integrations/email-transport.ts`, `lib/integrations/email.ts`, `src/emails/*` | Sends transactional emails and calendar invites/cancellations via Nodemailer + Gmail OAuth2. | `GMAIL_OAUTH_CLIENT_ID`, `GMAIL_OAUTH_CLIENT_SECRET`, `GMAIL_OAUTH_REFRESH_TOKEN`, `GMAIL_OAUTH_USER`, `EMAIL_FROM`. |
| Supabase Storage | `lib/integrations/resume-storage.ts`, `src/app/api/auth/signup/resume/route.ts`, `src/app/api/candidate/upload/resume/route.ts` | Uploads private PDF resumes, stores canonical storage URLs, and generates signed view links. | `STORAGE_SUPABASE_URL`, `STORAGE_SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_RESUME_BUCKET`. |
| Anthropic | `lib/integrations/claude.ts`, `lib/domain/qc/services.ts` | Runs LLM-based QC validation over professional feedback. | `ANTHROPIC_API_KEY`. |

### Stripe-specific persistence

- `User.stripeCustomerId` and `User.stripeAccountId` in `prisma/schema.prisma` store customer/connect-account identities.
- `Payment.stripePaymentIntentId` and `Payment.stripeRefundId` in `prisma/schema.prisma` persist payment-side identifiers.
- `Payout.proStripeAccountId` and `Payout.stripeTransferId` in `prisma/schema.prisma` persist payout-side identifiers.
- Professional onboarding/link generation is initiated from `src/app/api/professional/onboarding/route.ts` and implemented in `lib/domain/users/onboarding-service.ts`.
- Current code reads live/test Stripe keys directly; `STRIPE_CONNECT_CLIENT_ID` appears in `.env.example` but no runtime reads were found in `src`, `lib`, `prisma`, or `scripts`.

### Zoom-specific persistence

- `Booking` stores `zoomMeetingId`, shared/role-specific join URLs, registrant IDs, and calendar invite metadata in `prisma/schema.prisma`.
- `ZoomAttendanceEvent` in `prisma/schema.prisma` is the durable webhook/event ledger used by `src/app/api/shared/zoom/webhook/route.ts` and booking processors.
- Zoom invitation text is used both for direct booking logistics and for ICS email bodies in `lib/queues/notifications.ts` and `lib/integrations/email-calendar-invites.ts`.

## Queues, Workers, And Scheduled Work

| Queue / Trigger | Evidence | Purpose | Infra Dependency |
| --- | --- | --- | --- |
| `qc` queue | `lib/queues/index.ts`, `lib/queues/qc.ts`, `lib/domain/qc/services.ts` | QC review, timeout handling, and payout progression decisions. | Redis + Anthropic + Stripe. |
| `notifications` queue | `lib/queues/index.ts`, `lib/queues/notifications.ts` | Booking emails, payout notices, feedback revision emails, and calendar invite sends/cancels. | Redis + Gmail + Zoom invite text. |
| `payments` queue | `lib/queues/index.ts`, `lib/queues/payments.ts`, `lib/domain/payments/services.ts` | Deferred payout transfers. | Redis + Stripe. |
| `bookings` queue | `lib/queues/index.ts`, `lib/queues/bookings/worker.ts`, `lib/queues/bookings/processors.ts` | Booking confirmation/reschedule, expiry/no-show checks, Zoom attendance processing, and retention cleanup. | Redis + Zoom + DB. |
| Local repeatable jobs | `scripts/dev-queue.ts` | Registers hourly expiry, 5-minute no-show, and daily Zoom retention jobs for local worker runs. | `ENABLE_LOCAL_REPEAT_JOBS`, Redis. |
| Vercel cron triggers | `vercel.json`, `src/app/api/internal/cron/bookings/*`, `lib/core/cron-auth.ts` | Production scheduling entrypoints for expiry, no-show, and attendance-retention checks. | Vercel cron headers and optional `CRON_SECRET`. |

## Database Entities That Bridge External Systems

| Model / Field | Evidence | External Meaning |
| --- | --- | --- |
| `OAuthAccount` | `prisma/schema.prisma`, `lib/domain/auth/oauth-service.ts` | Stores provider account IDs, OAuth tokens, refresh tokens, scopes, and expiry for Google/LinkedIn. |
| `User.googleCalendarConnected`, `User.linkedinConnected` | `prisma/schema.prisma`, `lib/domain/auth/oauth-service.ts` | Cached provider-connection flags derived from linked OAuth accounts. |
| `Verification`, `PasswordResetToken` | `prisma/schema.prisma`, `lib/domain/users/verification-service.ts`, `lib/domain/auth/services.ts` | Email verification and password reset state used by the auth/email stack. |
| `Booking` external-id fields | `prisma/schema.prisma` | Zoom meeting/registrant/invite state lives directly on booking records. |
| `Payment`, `Payout` | `prisma/schema.prisma`, `lib/domain/payments/services.ts`, `lib/domain/qc/services.ts` | Persistent Stripe payment/refund/transfer linkage. |
| `AuditLog` | `prisma/schema.prisma`, `lib/domain/payments/services.ts`, admin flows | Records admin-triggered actions such as manual refunds. |
| `ZoomAttendanceEvent` | `prisma/schema.prisma`, `src/app/api/shared/zoom/webhook/route.ts` | Deduplicated raw Zoom webhook/event storage. |

## Env And Config Surface

### Clearly documented in `.env.example`

- Database and queue: `STORAGE_POSTGRES_PRISMA_URL`, `REDIS_URL`
- Auth providers: `AUTH_SECRET`, `NEXTAUTH_SECRET`, Google and LinkedIn OAuth vars
- Payments: Stripe secret/webhook/public test vars
- Zoom: credentials and attendance-tuning vars
- Email: Gmail OAuth2 + `EMAIL_FROM`
- Storage: `STORAGE_SUPABASE_URL`, `STORAGE_SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_RESUME_BUCKET`
- Seeds / AI: `SEED_POPULATION_MODE`, `ANTHROPIC_API_KEY`

### Active in code but underdocumented or undocumented

| Variable | Evidence | Why It Matters |
| --- | --- | --- |
| `NEXTAUTH_URL` | `lib/integrations/calendar/google.ts`, `src/app/api/auth/callback-redirect/route.ts` | Needed for OAuth/callback URL correctness. |
| `NEXT_PUBLIC_APP_URL` | `lib/integrations/email.ts` | Controls absolute links in outgoing emails. |
| `CRON_SECRET` | `lib/core/cron-auth.ts`, `tests/cron-auth.test.ts` | Optional bearer-token protection for cron routes. |
| `ENABLE_LOCAL_REPEAT_JOBS` | `scripts/dev-queue.ts` | Lets local worker runs skip repeatable-job registration. |
| `STORAGE_POSTGRES_URL_NON_POOLING` | `scripts/vercel-build.sh` | Overrides Prisma URL during Vercel build/migration. |

### Declared in docs/example but not currently read by runtime code

| Variable | Evidence | Comment |
| --- | --- | --- |
| `STRIPE_CONNECT_CLIENT_ID` | `.env.example` only | No runtime reads found; current Stripe Connect flow uses server-side account creation/link generation instead. |
| `PLATFORM_FEE` | `.env.example`, `README.md` only | Current payout math in `lib/domain/qc/services.ts` hardcodes the split logic instead of reading this env. |
| `FEATURE_LINKEDIN_ENHANCED` | `.env.example` only | No feature-flag checks found in app code. |
| `FEATURE_QC_LLM` | `.env.example`, `README.md` only | QC LLM code path is active without an env gate in current code. |
| `CALL_DURATION_MINUTES` | `.env.example`, `README.md` only | No runtime reads found. |
| `DEFAULT_TIMEZONE` | `.env.example`, `README.md` only | No runtime reads found; code uses stored/user/default fallbacks internally. |

## Supabase CLI Scaffolding Versus App Runtime

- `supabase/config.toml` introduces additional local config surfaces for SMTP, SMS/Twilio, external OAuth providers, and an `OPENAI_API_KEY` placeholder.
- A repo-wide search found active application reads for `ANTHROPIC_API_KEY`, but not for `OPENAI_API_KEY`; treat the Supabase OpenAI config as local CLI scaffolding, not an app integration.
- Likewise, the Next.js app does not use Supabase Auth as its primary auth system today; auth is handled in `src/auth.ts` with NextAuth, while Supabase is used directly for storage and optionally for hosted/local Postgres.

## Planning Notes

- The most coupled integrations are Stripe, Zoom, Gmail, and BullMQ because they span API routes, worker code, DB state, and user-facing flows.
- Environment management needs cleanup: several active variables are missing from `.env.example`, while several documented vars are currently inert.
- Production planning should treat the worker as a first-class deployable alongside the Next.js app, not as an optional local convenience.
