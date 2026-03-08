# Architecture Map

## System Shape

This repository is a full-stack marketplace application built as a single Next.js App Router app with a separate worker process for background jobs.

- The web surface lives in `src/app/` and mixes public pages, authenticated role-specific pages, and HTTP endpoints in `src/app/api/`.
- The main backend code does not live under `src/`; it lives in the root `lib/` tree and is resolved through the alias configuration in `tsconfig.json` and `vitest.config.ts`.
- Persistence is PostgreSQL through Prisma in `lib/core/db.ts` and `prisma/schema.prisma`.
- Asynchronous side effects run through BullMQ queues in `lib/queues/` and a separate worker bootstrap in `scripts/dev-queue.ts`.
- External systems include NextAuth providers in `src/auth.ts`, Stripe in `lib/integrations/stripe/index.ts`, Zoom in `lib/integrations/zoom.ts`, Supabase Storage in `lib/integrations/resume-storage.ts`, email delivery in `lib/integrations/email.ts`, Google Calendar support in `lib/integrations/calendar/google.ts`, and Claude QC checks in `lib/integrations/claude.ts`.

## Runtime Topology

| Runtime surface | Key paths | Responsibility |
| --- | --- | --- |
| Next.js request runtime | `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/`, `src/app/api/` | Server-render pages, serve API endpoints, host webhook and cron entry points |
| Auth runtime | `src/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts` | Credentials + OAuth sign-in, session shaping, onboarding flags |
| Database layer | `lib/core/db.ts`, `prisma/schema.prisma`, `prisma/migrations/` | Prisma client singleton, relational schema, SQL migrations |
| Background worker runtime | `scripts/dev-queue.ts`, `lib/queues/bookings/worker.ts`, `lib/queues/notifications.ts`, `lib/queues/payments.ts`, `lib/queues/qc.ts` | Execute queued jobs for bookings, notifications, payouts, and QC |
| External callback surfaces | `src/app/api/shared/stripe/webhook/route.ts`, `src/app/api/shared/zoom/webhook/route.ts` | Accept inbound Stripe and Zoom events and translate them into internal state changes |
| Scheduled job surfaces | `src/app/api/internal/cron/bookings/expiry/route.ts`, `src/app/api/internal/cron/bookings/no-show/route.ts`, `src/app/api/internal/cron/bookings/attendance-retention/route.ts` | Trigger system maintenance logic, protected by `lib/core/cron-auth.ts` |

## Layering

### 1. Presentation and route layer

- `src/app/` contains App Router pages and route handlers.
- `src/components/` contains client components, feature UI, hooks, and small browser-side service wrappers.
- Most pages are server components by default. Interactive islands are explicitly marked with `"use client"`, such as `src/components/bookings/CandidateBookingRequestForm.tsx`, `src/components/profile/ProfessionalProfileEditor.tsx`, and `src/components/layout/RoleAppShell.tsx`.

### 2. HTTP and access-control layer

- API endpoints live under `src/app/api/` and are grouped by actor or concern: `auth`, `candidate`, `professional`, `shared`, `admin`, and `internal`.
- Auth and role checks are enforced close to handlers rather than through a global middleware file. The main helpers are in `lib/core/api-helpers.ts`.
- `src/auth.ts` is the central auth boundary. Server pages and route handlers call `auth()` directly, while the browser gets session context via `SessionProvider` in `src/app/layout.tsx`.

### 3. Role/application service layer

- `lib/role/` packages use-case orchestration by actor.
- Candidate-oriented reads and writes live in files such as `lib/role/candidate/browse.ts`, `lib/role/candidate/bookings.ts`, and `lib/role/candidate/availability.ts`.
- Professional flows live in files such as `lib/role/professional/requests.ts`, `lib/role/professional/dashboard.ts`, and `lib/role/professional/earnings.ts`.
- Admin reads and actions live in files such as `lib/role/admin/bookings.ts`, `lib/role/admin/disputes.ts`, and `lib/role/admin/payments.ts`.

### 4. Domain layer

- `lib/domain/` holds reusable business logic and stateful rules.
- Booking lifecycle rules are centralized in `lib/domain/bookings/transitions/request.ts`, `lib/domain/bookings/transitions/scheduling.ts`, `lib/domain/bookings/transitions/dispute.ts`, and `lib/domain/bookings/transitions/lifecycle.ts`.
- User and onboarding rules live in `lib/domain/users/`.
- Auth-specific services live in `lib/domain/auth/`.
- QC and payout trigger logic lives in `lib/domain/qc/services.ts`.
- Payment/refund logic lives in `lib/domain/payments/services.ts`.

### 5. Infrastructure and integration layer

- `lib/core/` contains infrastructural helpers like `lib/core/db.ts`, `lib/core/rate-limit.ts`, `lib/core/cron-auth.ts`, and admin export helpers.
- `lib/integrations/` contains outbound adapters for third-party systems.
- `lib/queues/` bridges domain events into async workers and recurring jobs.

### 6. Persistence layer

- `prisma/schema.prisma` defines the core relational model: `User`, `Booking`, `Payment`, `Payout`, `CallFeedback`, `Dispute`, `Verification`, `ZoomAttendanceEvent`, `ProfessionalRating`, and the Prisma view `ListingCardView`.
- `lib/core/db.ts` provides a singleton Prisma client.
- Most business logic writes through Prisma directly from `lib/domain/` or `lib/role/`.

## Major Domains

| Domain | Primary paths | Notes |
| --- | --- | --- |
| Auth and identity | `src/auth.ts`, `src/app/api/auth/`, `lib/domain/auth/services.ts`, `lib/domain/auth/oauth-service.ts`, `src/types/next-auth.d.ts` | Credentials, Google, and LinkedIn sign-in; session contains role and onboarding flags |
| Onboarding and profiles | `src/app/onboarding/page.tsx`, `src/app/api/auth/onboarding/route.ts`, `lib/domain/users/profile-submit-service.ts`, `lib/domain/users/profile-upsert-service.ts`, `src/components/auth/OnboardingForm.tsx` | Candidate and professional onboarding flows share a submission pipeline |
| Browse and discovery | `src/app/candidate/browse/page.tsx`, `src/app/api/candidate/professionals/search/route.ts`, `lib/role/candidate/browse.ts` | Candidate browse reads from Prisma view `ListingCardView` |
| Availability and scheduling | `src/app/candidate/availability/page.tsx`, `src/app/api/candidate/availability/route.ts`, `lib/domain/availability/service.ts`, `lib/shared/time-slot.ts` | Candidate availability is stored in DB and reused for booking and reschedule flows |
| Booking lifecycle | `src/app/api/candidate/professionals/[id]/bookings/route.ts`, `src/app/api/professional/requests/[id]/confirm-and-schedule/route.ts`, `lib/role/candidate/bookings.ts`, `lib/role/professional/requests.ts`, `lib/domain/bookings/transitions/` | Core marketplace transaction flow from request through completion, cancellation, reschedule, and disputes |
| Feedback, QC, and reviews | `src/app/api/professional/feedback/[bookingId]/route.ts`, `lib/domain/qc/services.ts`, `lib/domain/reviews/service.ts`, `lib/integrations/claude.ts` | Professional feedback is validated first by rules, then by Claude, then drives payout state |
| Payments and payouts | `src/app/api/shared/stripe/webhook/route.ts`, `src/app/api/admin/payments/refund/route.ts`, `lib/domain/payments/services.ts`, `lib/integrations/stripe/index.ts` | Manual-capture Stripe flow plus Connect payouts and admin refunds |
| Verification and trust | `src/app/api/shared/verification/request/route.ts`, `src/app/api/shared/verification/confirm/route.ts`, `lib/domain/users/verification-service.ts` | Professional onboarding depends on corporate email verification |
| Admin operations | `src/app/admin/`, `src/app/api/admin/`, `lib/domain/admin/disputes.ts`, `lib/core/admin-export.ts` | Admin UIs, exports, refunds, dispute resolution, Zoom link management |
| Async attendance and notifications | `src/app/api/shared/zoom/webhook/route.ts`, `lib/queues/bookings/attendance-processor.ts`, `lib/queues/notifications.ts`, `lib/integrations/email.ts` | Attendance evidence, calendar invites, reminders, and email fan-out |

## Data Flow

### Server-render read flow

1. A request enters a page in `src/app/`.
2. The page reads the session with `auth()` or `requireRole()` from `lib/core/api-helpers.ts`.
3. The page calls a role or shared query module such as `lib/role/candidate/browse.ts` or `lib/shared/bookings/upcoming.ts`.
4. Prisma reads from PostgreSQL through `lib/core/db.ts`.
5. The page renders server HTML and hands any interactive parts to client components in `src/components/`.

Representative examples:

- `src/app/candidate/browse/page.tsx` -> `lib/role/candidate/browse.ts` -> `prisma/schema.prisma` view `ListingCardView`
- `src/app/professional/requests/page.tsx` -> `lib/shared/bookings/upcoming.ts`
- `src/app/admin/payments/page.tsx` -> `lib/role/admin/payments.ts`

### Browser mutation flow

1. A client component or hook in `src/components/` issues `fetch()` calls through a local service wrapper such as `src/components/bookings/services/candidateBookingApi.ts`.
2. The request hits a `route.ts` file in `src/app/api/`.
3. The route validates input with `zod`, authorizes via `auth()` or `withRole*`, then calls a role or domain service.
4. The service writes to Prisma and may enqueue async jobs through `lib/queues/index.ts`.
5. The client displays progress and navigation through tracked actions in `src/components/ui/actions/executeTrackedAction.ts`.

### Booking lifecycle flow

The core marketplace path is:

1. Candidate requests a booking through `src/app/api/candidate/professionals/[id]/bookings/route.ts`.
2. `lib/role/candidate/bookings.ts` records availability and calls `createBookingRequest` in `lib/domain/bookings/transitions/request.ts`.
3. The transition creates a Stripe PaymentIntent, creates `Booking` and `Payment` rows, and enqueues a notification.
4. The professional confirms through `src/app/api/professional/requests/[id]/confirm-and-schedule/route.ts`.
5. `lib/role/professional/requests.ts` captures payment, advances the booking state, stores schedule data, and enqueues `confirm-booking`.
6. `lib/queues/bookings/confirmation-processor.ts` and related queue processors handle Zoom meeting creation, invite fan-out, and follow-up system work.
7. After the call, professional feedback enters `lib/domain/qc/services.ts`; passing QC completes the booking and enqueues payout processing.

### Webhook and cron flow

- Stripe events enter `src/app/api/shared/stripe/webhook/route.ts` and synchronize payment state through `lib/integrations/stripe/confirm.ts`.
- Zoom attendance events enter `src/app/api/shared/zoom/webhook/route.ts`, persist raw webhook records to `ZoomAttendanceEvent`, and enqueue processing on the bookings queue.
- Cron routes in `src/app/api/internal/cron/bookings/` call queue processors directly, while local/dev repeat jobs are also registered in `scripts/dev-queue.ts`.

## Server and Client Boundaries

- Server-first rendering is the default. Pages like `src/app/candidate/browse/page.tsx` and `src/app/onboarding/page.tsx` fetch data on the server.
- Interactivity is pushed into `"use client"` modules, especially under `src/components/` and a few route-local files such as `src/app/candidate/bookings/[id]/BookingActions.tsx`.
- There are no React server actions in the current codebase; all writes go through HTTP route handlers in `src/app/api/`.
- Client session context is provided globally by `SessionProvider` in `src/app/layout.tsx`, but authoritative auth checks still happen server-side in `src/auth.ts` and `lib/core/api-helpers.ts`.
- There is no root `middleware.ts`. Access control is decentralized across pages and endpoints.
- Background queues are not hosted inside the Next.js request runtime. Running the app correctly requires both `npm run dev` and `npm run dev:queue`, matching the setup documented in `README.md`.

## Key Entry Points

- `src/app/layout.tsx`: root HTML shell, session provider, toast provider, global navbar
- `src/app/page.tsx`: public landing entry that delegates to `src/app/(public)/`
- `src/auth.ts`: central auth/session configuration
- `src/app/api/auth/[...nextauth]/route.ts`: auth API surface
- `src/app/onboarding/page.tsx`: authenticated onboarding gate
- `src/app/candidate/browse/page.tsx`: representative role-based read page
- `src/app/api/candidate/professionals/[id]/bookings/route.ts`: booking creation entry
- `src/app/api/professional/requests/[id]/confirm-and-schedule/route.ts`: professional scheduling entry
- `src/app/api/shared/stripe/webhook/route.ts`: payment webhook entry
- `src/app/api/shared/zoom/webhook/route.ts`: attendance webhook entry
- `src/app/api/internal/cron/bookings/expiry/route.ts`: scheduled maintenance entry
- `scripts/dev-queue.ts`: worker bootstrap and local repeat-job registration
- `prisma/seed.ts`: development data bootstrap

## Planning Notes

- Architectural seams are strongest around `lib/role/`, `lib/domain/`, and `lib/integrations/`. Those are the safest starting points for feature planning.
- The repo follows a server-rendered page plus client-island pattern. Changes that affect mutations usually need updates in both browser wrappers like `src/components/bookings/services/candidateBookingApi.ts` or `src/components/admin/services/adminMutationApi.ts` and the matching handlers in `src/app/api/`.
- Booking behavior is state-machine-heavy; changes should usually start in `lib/domain/bookings/transitions/` rather than directly in pages or route handlers.
- Queue-dependent features are multi-process by design. Any planning that touches booking acceptance, QC, attendance, emails, or payouts should account for both request-time and worker-time execution paths.
