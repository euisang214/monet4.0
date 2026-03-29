# Structure Map

## Top-Level Layout

| Path | Purpose |
| --- | --- |
| `src/app/` | Next.js App Router pages, layouts, and API route handlers |
| `src/components/` | UI components, client hooks, and browser-side service wrappers |
| `src/emails/` | React Email templates and rendering helpers |
| `src/types/` | Type augmentation, currently including `src/types/next-auth.d.ts` |
| `lib/` | Main backend code: domain logic, role services, integrations, queues, shared helpers |
| `prisma/` | Prisma schema, migrations, and seed scripts |
| `scripts/` | Operational scripts such as `scripts/dev-queue.ts` and `scripts/vercel-build.sh` |
| `tests/` | Vitest unit/integration tests plus `tests/e2e/` flow tests |
| `public/` | Static public assets |
| `supabase/` | Local Supabase support files and snippets |
| `.planning/codebase/` | Planning outputs, including this document and `ARCHITECTURE.md` |
| `.next/`, `coverage/`, `node_modules/`, `output/playwright/` | Generated or tool-owned output that should usually be ignored during planning |

## App Router Layout

### Public and auth-facing routes

- `src/app/(public)/` holds the marketing-facing landing and pricing pages.
- `src/app/page.tsx` simply delegates to the public route group.
- `src/app/login/`, `src/app/signup/`, `src/app/forgot-password/`, `src/app/auth/reset/`, and `src/app/onboarding/` hold authentication and onboarding UI.

### Role-based product routes

- `src/app/candidate/` contains candidate-facing pages such as browse, availability, settings, booking details, disputes, reviews, and booking flows.
- `src/app/professional/` contains professional-facing dashboard, requests, earnings, settings, and feedback pages.
- `src/app/admin/` contains admin dashboards for bookings, disputes, feedback, payments, and users.
- Each role area has a `layout.tsx` file, but those layouts are thin wrappers around `src/components/layout/AuthenticatedContentFrame.tsx`.

### API route layout

- `src/app/api/auth/` contains auth lifecycle endpoints such as signup, onboarding, password reset, linked providers, and `src/app/api/auth/[...nextauth]/route.ts`.
- `src/app/api/candidate/` contains candidate-only endpoints for availability, booking creation, dispute submission, reviews, profile reads, resume upload, and browse reads.
- `src/app/api/professional/` contains professional-only endpoints for booking confirmation, decline, reschedule, feedback, and onboarding.
- `src/app/api/admin/` contains admin mutation and export endpoints.
- `src/app/api/shared/` contains cross-role or system endpoints such as settings, verification, Stripe account onboarding, Stripe webhooks, Zoom webhooks, booking cancellation, and QC recheck.
- `src/app/api/internal/cron/` contains cron-triggered maintenance endpoints.

## Backend Module Layout

| Path | Responsibility | Representative files |
| --- | --- | --- |
| `lib/core/` | Infrastructure glue and low-level app helpers | `lib/core/db.ts`, `lib/core/api-helpers.ts`, `lib/core/cron-auth.ts`, `lib/core/rate-limit.ts` |
| `lib/domain/` | Business rules and state transitions by bounded area | `lib/domain/bookings/transitions/request.ts`, `lib/domain/payments/services.ts`, `lib/domain/qc/services.ts`, `lib/domain/users/profile-submit-service.ts` |
| `lib/role/` | Actor-specific orchestration and read models | `lib/role/candidate/browse.ts`, `lib/role/candidate/bookings.ts`, `lib/role/professional/requests.ts`, `lib/role/admin/payments.ts` |
| `lib/shared/` | Cross-role helpers and reusable business utilities | `lib/shared/routes.ts`, `lib/shared/booking-actions.ts`, `lib/shared/bookings/upcoming.ts`, `lib/shared/qc.ts` |
| `lib/integrations/` | Third-party service adapters | `lib/integrations/stripe/index.ts`, `lib/integrations/zoom.ts`, `lib/integrations/email.ts`, `lib/integrations/resume-storage.ts`, `lib/integrations/claude.ts` |
| `lib/queues/` | Queue producers, workers, and async processors | `lib/queues/index.ts`, `lib/queues/bookings/worker.ts`, `lib/queues/notifications.ts`, `lib/queues/payments.ts`, `lib/queues/qc.ts` |
| `lib/types/` | Shared request/validation schemas | `lib/types/booking-schemas.ts`, `lib/types/profile-schemas.ts` |
| `lib/utils/` | Generic utility helpers, mostly date/time oriented | `lib/utils/date.ts`, `lib/utils/timezones.ts`, `lib/utils/supported-timezones.ts` |
| `lib/ui/` | Small shared UI-adjacent utilities usable across layers | `lib/ui/cn.ts` |

## UI and Component Layout

| Path | Responsibility |
| --- | --- |
| `src/components/auth/` | Login, signup, onboarding, and provider-connection UI |
| `src/components/bookings/` | Booking forms, request actions, availability UI, and booking-related hooks/services |
| `src/components/browse/` | Candidate browse cards and styling |
| `src/components/dashboard/` | Professional dashboard widgets and QC toast support |
| `src/components/feedback/` | Feedback submission UI |
| `src/components/profile/` | Candidate/professional profile editors and shared form sections |
| `src/components/layout/` | Global navigation, authenticated shells, and section nav UI |
| `src/components/admin/` | Admin-specific UI and tracked admin mutations |
| `src/components/ui/` | Shared design system primitives, composites, providers, and action helpers |

Inside `src/components/ui/`, there is a clear internal split:

- `src/components/ui/primitives/` for low-level reusable controls
- `src/components/ui/composites/` for richer shared widgets like `DataTable` and `PageHeader`
- `src/components/ui/providers/` for top-level providers such as `RequestToastProvider`
- `src/components/ui/hooks/` for UI-specific state helpers
- `src/components/ui/actions/` for cross-feature interaction patterns like tracked requests

## Data and Infra Layout

- `prisma/schema.prisma` is the canonical data model.
- `prisma/migrations/` stores generated migration SQL, organized by timestamped folder.
- `prisma/seed.ts` and `prisma/seed-stripe.ts` provide development and test data setup.
- `docker-compose.yml` provisions local Postgres and Redis.
- `.env.example` documents required runtime configuration for DB, Redis, Stripe, Supabase, OAuth, Zoom, and email.

## Naming and Location Patterns

### Next.js conventions

- Server pages use `page.tsx`.
- Nested shells use `layout.tsx`.
- HTTP endpoints use `route.ts`.
- Dynamic route segments use bracket notation such as `src/app/admin/bookings/[id]/page.tsx` and `src/app/api/professional/requests/[id]/confirm-and-schedule/route.ts`.

### Feature pairing pattern

The codebase often groups a server page with nearby client-only helpers:

- `src/app/candidate/availability/page.tsx` pairs with `src/app/candidate/availability/CandidateAvailabilityEditor.tsx`
- `src/app/candidate/bookings/[id]/page.tsx` pairs with `src/app/candidate/bookings/[id]/BookingActions.tsx`
- `src/app/admin/bookings/[id]/page.tsx` pairs with `src/app/admin/bookings/[id]/ZoomLinkForm.tsx`

This is a recurring pattern for interactive route-local UI.

### Service naming pattern

- Role-level modules are usually exported as `*Service` or named objects in `lib/role/`, for example `AdminPaymentService` in `lib/role/admin/payments.ts`.
- Domain services follow the same pattern in `lib/domain/`, for example `QCService` in `lib/domain/qc/services.ts` and `VerificationService` in `lib/domain/users/verification-service.ts`.
- Booking state changes are split by lifecycle stage inside `lib/domain/bookings/transitions/` rather than placed in one large file.

### Client-side integration pattern

- Browser calls are wrapped in feature-local files like `src/components/bookings/services/candidateBookingApi.ts`, `src/components/bookings/services/professionalBookingApi.ts`, and `src/components/admin/services/adminMutationApi.ts`.
- Browser hooks live next to their feature area under `hooks/`, such as `src/components/bookings/hooks/` and `src/components/auth/hooks/`.
- Toast and navigation tracking is standardized through `src/components/ui/actions/executeTrackedAction.ts`.

### Test naming pattern

- Most tests are flat feature-oriented files under `tests/`, for example `tests/candidate-prebooking.test.ts`, `tests/professional-feedback.test.ts`, and `tests/payments.test.ts`.
- End-to-end or flow-style tests live in `tests/e2e/`.
- Shared test utilities live under `tests/helpers/`, `tests/mocks/`, and `tests/setup/`.

## Where Major Responsibilities Live

| Responsibility | Start here |
| --- | --- |
| Auth/session behavior | `src/auth.ts`, `src/app/api/auth/`, `src/types/next-auth.d.ts` |
| Candidate browse and booking request flows | `src/app/candidate/`, `src/app/api/candidate/`, `lib/role/candidate/`, `src/components/bookings/` |
| Professional request handling and scheduling | `src/app/professional/`, `src/app/api/professional/`, `lib/role/professional/requests.ts` |
| Booking state transitions | `lib/domain/bookings/transitions/` |
| Payments, refunds, and payouts | `lib/domain/payments/services.ts`, `lib/integrations/stripe/index.ts`, `src/app/api/admin/payments/`, `src/app/api/shared/stripe/webhook/route.ts` |
| Feedback QC and post-call review | `lib/domain/qc/services.ts`, `lib/domain/reviews/service.ts`, `src/app/api/professional/feedback/[bookingId]/route.ts` |
| Admin review and exports | `src/app/admin/`, `src/app/api/admin/`, `lib/domain/admin/disputes.ts`, `lib/core/admin-export.ts` |
| Email, Zoom, resume storage, and other third-party adapters | `lib/integrations/` |
| Background jobs and repeatable processing | `lib/queues/`, `scripts/dev-queue.ts` |
| Schema changes and seed data | `prisma/schema.prisma`, `prisma/migrations/`, `prisma/seed.ts` |

## Important Structural Quirks

- The `@` alias points to `src/`, while a separate alias maps imports like `@/lib/core/db` to the root `lib/` directory rather than `src/lib/`.
- `src/lib/` currently has no active source files; backend code is concentrated in the root `lib/` tree.
- There is no global `middleware.ts`. If planning work depends on access control or redirects, inspect the page or route handler directly.
- The app is multi-process in development and production shape: the web server and queue worker are separate concerns.

## Planning Guidance

- For UI work, start in the relevant route folder under `src/app/`, then move into the matching feature folder under `src/components/`.
- For behavior changes, start in `lib/role/` if the rule is actor-specific, or `lib/domain/` if it is a reusable business rule.
- For async side effects, trace from the route handler into `lib/queues/index.ts`, then into the matching worker or processor file.
- For data model changes, modify `prisma/schema.prisma` first, then assess the affected role/domain services and tests.
- For test updates, add or extend the closest scenario-named file under `tests/` instead of mirroring production directories one-to-one.
