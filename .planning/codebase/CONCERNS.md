# Codebase Concerns Map

## Scope

This document maps the main planning concerns in the current repository with a focus on technical debt, fragility, security risk, performance risk, operational risk, and work that appears incomplete or mid-migration.

The codebase is a `Next.js` marketplace app with role-based flows, `Prisma`, `BullMQ`, `Stripe`, `Zoom`, `Google Calendar`, `Supabase` resume storage, `NextAuth`, and Anthropic-backed QC. The biggest recurring concern is that business state changes and external side effects are only loosely coordinated, while access control and migration cleanup are still uneven across the surface area.

## Highest-Priority Concerns

### 1. Shared API authorization is inconsistent and exposes sensitive workflows

- `src/app/api/shared/qc/[bookingId]/recheck/route.ts` only checks for any authenticated session, then lets that user enqueue QC for any booking ID. There is no admin check, no booking ownership check, and the `jobId` uses `Date.now()`, so retries are intentionally non-idempotent.
- `src/app/api/shared/reviews/route.ts` only requires authentication and returns the full payload from `lib/domain/reviews/service.ts`, which includes `candidateEmail`. That creates an unnecessary privacy leak across accounts.
- `src/app/api/candidate/availability/route.ts` applies a candidate role check for `POST` but not for `GET`, which is a concrete example of auth drift inside the same file.
- `lib/core/api-helpers.ts` provides shared auth wrappers, but only a minority of route handlers in `src/app/api/` use them. Most routes still hand-roll session and role checks, which increases the chance of subtle access-control regressions.

Why it matters:
- The shared routes are high leverage. One weak handler can bypass otherwise careful role partitioning.
- Inconsistent auth logic is hard to review and easy to regress during refactors.

Planning direction:
- Centralize API auth/role enforcement on top of `lib/core/api-helpers.ts`.
- Audit every `src/app/api/shared/**` route for least-privilege access and output filtering.

### 2. Security controls exist, but several are only partial or development-grade

- `lib/core/rate-limit.ts` is an in-memory map and explicitly documents that production should use Redis, but it is currently used by `src/app/api/auth/[...nextauth]/route.ts`, `src/app/api/shared/verification/request/route.ts`, `src/app/api/shared/verification/confirm/route.ts`, and `src/app/api/candidate/professionals/[id]/bookings/route.ts`. In multi-instance production, this will not enforce global limits.
- `lib/core/cron-auth.ts` falls back to trusting `x-vercel-cron` or a `user-agent` substring when `CRON_SECRET` is missing. That is weaker than a real shared secret on public HTTP routes.
- `lib/domain/users/verification-service.ts` generates 6-character email verification codes with `Math.random()` and stores them in plaintext in `prisma/schema.prisma` (`model Verification`). This is weaker than a cryptographically strong token or hashed verifier pattern.
- `src/app/api/auth/signup/resume/route.ts` is an unauthenticated upload endpoint backed by `lib/integrations/resume-storage.ts`. It only checks file size and claimed PDF type/extension, which leaves room for storage abuse and unowned orphan uploads.
- `lib/integrations/zoom-attendance.ts` verifies the HMAC signature but does not reject stale timestamps, so it lacks replay-window protection.
- `lib/integrations/stripe/index.ts` will use `STRIPE_TEST_SECRET_KEY` outside test mode if `STRIPE_SECRET_KEY` is absent. That is a deployment safety footgun.

Why it matters:
- These are the kinds of controls that look present during review but fail under real deployment topologies or abuse cases.
- Several of them affect public or semi-public endpoints directly.

Planning direction:
- Replace `lib/core/rate-limit.ts` with a shared Redis-backed limiter.
- Make `CRON_SECRET` mandatory in production.
- Rework verification and upload flows around stronger tokens, tighter ownership, and abuse controls.

### 3. Booking, payment, and notification flows are not coordinated strongly enough

- `lib/domain/bookings/transitions/request.ts` creates a Stripe `PaymentIntent` before the database transaction that creates `Booking` and `Payment`. If the transaction fails, Stripe state is left behind without local ownership.
- `lib/role/professional/requests.ts` transitions the booking to `accepted_pending_integrations`, then updates `startAt` and `endAt` in a second step, then enqueues the background job after that. The comments in the file already call out the gap.
- `lib/domain/bookings/transitions/lifecycle.ts` performs Stripe cancels/refunds inside the same logical transition path as database writes. If the external side effect succeeds and the DB transaction later fails, recovery becomes manual.
- `lib/domain/bookings/transitions/shared.ts` enqueues calendar invite jobs after transitions commit. If queue submission fails, the booking state changes but the side effects disappear.
- `lib/domain/qc/services.ts` enqueues notification types such as `feedback_revise_nudge` and `payout_initiated`, but `lib/queues/notifications.ts` does not implement handlers for those types. Those jobs are effectively dead letters in waiting.
- `src/app/api/shared/bookings/[id]/cancel/route.ts` contains an explicit “strict role facade might not be ready” comment and falls back to direct transition calls for professionals.

Why it matters:
- Revenue, refunds, booking status, invites, and QC all depend on these paths.
- The current design is vulnerable to partial completion and silent side-effect loss.

Planning direction:
- Introduce a durable side-effect/outbox pattern for Stripe, Zoom, calendar invites, and email.
- Collapse multi-step accept/reschedule flows into single idempotent orchestration units with explicit recovery paths.
- Close the gap between queued job types and worker implementations.

## Performance and Scalability Risks

### Availability and scheduling logic scales in application code

- `lib/domain/availability/service.ts` loads manual availability, bookings, and Google busy intervals, then subtracts each busy interval from the slot list in memory via `lib/shared/time-slot.ts`.
- `lib/integrations/calendar/google.ts` returns an empty list on any error, which fails open. Availability may look wider than reality when Google integration breaks.

Risk:
- Complexity grows with the number of slots and busy intervals.
- Calendar integration failures silently degrade correctness instead of producing a visible degraded-state signal.

### Batch processors are chunked narrowly and still do per-record work

- `lib/queues/bookings/expiry-processor.ts` and `lib/queues/bookings/no-show-processor.ts` hard-cap each run at `take: 50`.
- `lib/queues/bookings/no-show-processor.ts` also does extra per-booking work, including a `zoomAttendanceEvent.count()` query inside the loop.
- The HTTP cron routes in `src/app/api/internal/cron/bookings/` call these processors inline instead of just enqueueing work.

Risk:
- A backlog larger than one chunk takes repeated cron runs to drain.
- Inline HTTP execution increases timeout sensitivity on hosting platforms.

### Read models still carry type and query uncertainty

- `lib/role/candidate/browse.ts` uses `// @ts-ignore` around `prisma.listingCardView.findMany(...)`, which is a signal that the type-safe read path is not fully settled.
- `lib/domain/reviews/service.ts` and `lib/role/professional/dashboard.ts` fetch full candidate experience and education trees just to build display labels for review and dashboard lists.

Risk:
- Read-path performance is harder to reason about because query shapes are broad and the type system is being bypassed.

## Operational Risks

### Production requires multiple always-on moving parts

- `README.md` requires both the Next.js app and `npm run dev:queue`.
- `scripts/dev-queue.ts` registers repeat jobs locally, but production relies on separate cron HTTP routes under `src/app/api/internal/cron/bookings/`.
- There is no visible repo-level deployment orchestration for the worker, cron triggers, or health checks.

Risk:
- It is easy to deploy the web app without the worker or without the cron triggers and silently lose background processing.

### Test and seed workflows are not hermetic

- `tests/setup/env.ts` fails the entire test suite if `STRIPE_TEST_SECRET_KEY` and `STRIPE_TEST_WEBHOOK_SECRET` are missing.
- `tests/helpers/stripe-live.ts` and `README.md` confirm that tests depend on live Stripe test-mode API calls.
- `prisma/seed.ts` and `prisma/seed-stripe.ts` also create real Stripe test objects during seeding.
- `vitest.config.ts` enables coverage reporting but does not enforce thresholds.

Risk:
- Fast local validation is harder than it should be.
- CI is more likely to be slow, flaky, or externally rate-limited.
- Coverage can regress without a failing gate.

### Email is a production-critical single integration point

- `lib/integrations/email-transport.ts` throws at import time in production if Gmail OAuth env vars are missing.
- All transactional email currently depends on one Gmail OAuth transport path.

Risk:
- Misconfiguration can break entire runtime paths instead of degrading gracefully.
- There is no provider redundancy for a core communications channel.

## Technical Debt and Incomplete Areas

### The Prisma schema still contains unresolved implementation notes

- `prisma/schema.prisma` includes long first-person implementation commentary around `ProfessionalProfile`, `Experience`, and `Verification`.
- The schema contains fields such as `professionalActivityId` and `candidateActivityId` that appear to have been introduced to work around the unresolved `experience` vs `activities` modeling question.

Risk:
- The schema is functioning as both source of truth and scratchpad. That makes future migrations harder to trust.

### Several subsystems are visibly mid-migration

- `src/styles/utilities-legacy.css`, `src/app/globals.css`, and `src/components/ui/README.md` all describe the current UI utility layer as legacy or deprecated.
- `src/proxy.ts` exists while `tests/middleware-onboarding-gate.test.ts` still reflects the old middleware naming, which is a small but real sign of an ongoing framework migration.
- `lib/shared/time-slot.ts` explicitly says logic was moved from `lib/domain/shared/availability.ts`.
- `lib/queues/notifications.ts` contains a backward-compatibility shim for older queued jobs.
- `src/app/api/shared/bookings/[id]/cancel/route.ts` explicitly says the stricter professional role facade is not ready.

Risk:
- Migration shims are often where duplicate behavior and stale assumptions accumulate.

### Profile and onboarding logic is fragmented

- `lib/domain/users/service.ts`, `lib/domain/users/profile-service.ts`, `lib/domain/users/profile-upsert-service.ts`, and `lib/domain/users/profile-submit-service.ts` all participate in profile persistence or validation.
- This makes it harder to know which layer owns invariants for resume handling, corporate email verification, onboarding completion, and settings updates.

Risk:
- Changes to profile behavior require touching several files with overlapping responsibilities.

## Practical Planning Candidates

### Candidate 1: Access-control hardening

Focus files:
- `src/app/api/shared/qc/[bookingId]/recheck/route.ts`
- `src/app/api/shared/reviews/route.ts`
- `src/app/api/candidate/availability/route.ts`
- `lib/core/api-helpers.ts`

Expected outcome:
- Shared routes have explicit ownership or admin checks, outputs are filtered, and route auth patterns are standardized.

### Candidate 2: Payment and booking orchestration reliability

Focus files:
- `lib/domain/bookings/transitions/request.ts`
- `lib/role/professional/requests.ts`
- `lib/domain/bookings/transitions/lifecycle.ts`
- `lib/domain/bookings/transitions/shared.ts`
- `lib/queues/notifications.ts`

Expected outcome:
- Booking state, Stripe actions, Zoom setup, and notifications are idempotent and recoverable.

### Candidate 3: Security control hardening

Focus files:
- `lib/core/rate-limit.ts`
- `lib/core/cron-auth.ts`
- `lib/domain/users/verification-service.ts`
- `src/app/api/auth/signup/resume/route.ts`
- `lib/integrations/zoom-attendance.ts`

Expected outcome:
- Abuse controls become production-grade and externally exposed routes stop depending on weak defaults.

### Candidate 4: Migration cleanup and simplification

Focus files:
- `prisma/schema.prisma`
- `src/styles/utilities-legacy.css`
- `src/components/ui/README.md`
- `lib/domain/users/profile-service.ts`
- `lib/domain/users/profile-upsert-service.ts`
- `lib/domain/users/profile-submit-service.ts`

Expected outcome:
- The codebase is easier to reason about because migration notes, compatibility shims, and duplicate ownership lines are reduced.

## Bottom Line

The repository is already beyond prototype scale, but several of its most important workflows still depend on optimistic coordination between HTTP handlers, DB transactions, queues, and third-party APIs. The biggest planning win is to treat security consistency and side-effect reliability as first-class infrastructure work before adding much more product surface on top.
