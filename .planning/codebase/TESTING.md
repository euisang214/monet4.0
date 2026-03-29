# Testing Map

## Frameworks and commands

- `package.json` defines the main entry points:
  `npm test` runs `vitest run`,
  `npm run test:watch` runs interactive Vitest,
  `npm run test:coverage` enables V8 coverage,
  `npm run test:e2e` still runs Vitest and scopes to `tests/e2e/`.
- `vitest.config.ts` is the authoritative test config. Important defaults are:
  Node environment,
  globals enabled,
  `tests/setup/env.ts` loaded before the suite,
  long timeouts,
  `fileParallelism: false`,
  V8 coverage over `src/**/*.ts(x)` and `lib/**/*.ts`.
- Coverage reporting is configured, but there is no threshold gate in `vitest.config.ts`. Coverage is informative, not enforced.
- `tests/setup/env.ts` requires live Stripe test credentials such as `STRIPE_TEST_SECRET_KEY` and `STRIPE_TEST_WEBHOOK_SECRET`, so the suite is not zero-config in a fresh environment.

## Test layout

- Most tests live flat under `tests/` and are named after the feature, route, or module under test, for example `tests/auth-onboarding-route.test.ts`, `tests/profile-upsert-service.test.ts`, and `tests/admin-bookings-page.test.tsx`.
- Higher-level flow tests live in `tests/e2e/`, such as `tests/e2e/flow.test.ts` and `tests/e2e/reschedule-flow.test.ts`.
- Shared support code is limited but present:
  `tests/setup/env.ts` for environment bootstrapping,
  `tests/helpers/stripe-live.ts` for real Stripe helpers,
  `tests/mocks/zoom.ts` for Zoom mocks,
  `tests/e2e/fixtures.ts` for actor creation and cleanup.
- The layout mirrors the application architecture reasonably well, but it is not deeply foldered by domain. Planning work should expect to search by file name rather than by nested test package.

## Common test styles

- Pure utilities and domain logic are tested directly with regular Vitest assertions, for example `tests/payments.test.ts`, `tests/utils.test.ts`, and `tests/identity-labels.test.ts`.
- Prisma-heavy modules usually mock `@/lib/core/db` with inline object graphs and `vi.hoisted(...)`, as seen in `tests/profile-upsert-service.test.ts`, `tests/user-service.test.ts`, and `tests/professional-dashboard-data.test.ts`.
- Route handlers are commonly imported directly and invoked with `new Request(...)`, which keeps route tests fast and avoids spinning up Next.js. Examples include `tests/auth-onboarding-route.test.ts`, `tests/shared-settings-route.test.ts`, and `tests/cron-bookings-routes.test.ts`.
- Partial module mocking is common when the test wants real types or helper exports but fake side effects. `tests/auth-onboarding-route.test.ts` and `tests/shared-settings-route.test.ts` both use `vi.importActual(...)`.
- Client fetch wrappers tend to stub `globalThis.fetch` and assert request payload wiring, as in `tests/candidate-booking-hooks-timezone.test.ts` and `tests/tracked-action-services.test.ts`.
- Shared mutation hooks and tracked-action helpers are tested by mocking router and toast runtimes, then rendering small harnesses or calling the helper directly. See `tests/tracked-domain-wrappers.test.tsx` and `tests/execute-tracked-action.test.ts`.
- Queue and worker tests mock BullMQ and capture processors instead of connecting to Redis. `tests/queue-bookings.test.ts` and `tests/notifications-worker-booking-accepted.test.ts` are the clearest examples.

## React test approach

- The repo does not use a browser or JSDOM renderer in `vitest.config.ts`; the environment is `node`.
- Most `*.tsx` tests therefore use `renderToStaticMarkup` from `react-dom/server` and assert rendered HTML strings. Representative files are `tests/admin-bookings-page.test.tsx`, `tests/landing-render.test.tsx`, `tests/auth-navbar.test.tsx`, and `tests/professional-profile-editor.test.tsx`.
- This approach is effective for server components, route-local page composition, and static branching logic.
- It is not a substitute for user-interaction coverage on client-heavy flows such as `src/components/auth/OnboardingForm.tsx`, `src/components/profile/CandidateProfileEditor.tsx`, `src/components/bookings/CandidateBookingRequestForm.tsx`, `src/components/bookings/WeeklySlotCalendar.tsx`, and `src/components/ui/providers/RequestToastProvider.tsx`.

## Common helpers and mocking patterns

- `vi.hoisted(...)` is used heavily to define mocks before module import order matters. See `tests/auth-onboarding-route.test.ts`, `tests/tracked-domain-wrappers.test.tsx`, and `tests/notifications-worker-booking-accepted.test.ts`.
- Local helper factories are common and often repeated instead of centralized:
  `makeRequest(...)` in route tests,
  `jsonResponse(...)` in fetch-wrapper tests,
  `createRuntime()` in `tests/execute-tracked-action.test.ts`,
  `createCapture()` in `tests/tracked-domain-wrappers.test.tsx`.
- `tests/e2e/fixtures.ts` is the main reusable fixture layer for multi-actor booking flows. It creates users, books sessions, and cleans up database rows.
- `tests/helpers/stripe-live.ts` uses real Stripe test credentials and is shared by the flow specs under `tests/e2e/`.
- `tests/mocks/zoom.ts` provides the standard Zoom stub and is imported through `vi.mock('@/lib/integrations/zoom', ...)` in multiple tests.

## What is covered well

- Auth, role gating, and onboarding flows are covered across `tests/auth-service.test.ts`, `tests/auth-callback-redirect-route.test.ts`, `tests/auth-onboarding-route.test.ts`, `tests/professional-onboarding-route.test.ts`, and `tests/middleware-onboarding-gate.test.ts`.
- Profile validation and persistence logic are covered in `tests/profile-submit-service.test.ts`, `tests/profile-upsert-service.test.ts`, `tests/profile-service.test.ts`, `tests/candidate-profile-editor.test.tsx`, and `tests/professional-profile-editor.test.tsx`.
- Booking lifecycle and queue behavior have meaningful coverage in `tests/transitions.test.ts`, `tests/reschedule.test.ts`, `tests/queue-bookings.test.ts`, `tests/notifications-worker-booking-accepted.test.ts`, and the `tests/e2e/*.test.ts` flow specs.
- Route and page composition coverage is broad for a Next.js app, with many direct handler and server-render tests such as `tests/shared-settings-route.test.ts`, `tests/admin-bookings-page.test.tsx`, and `tests/candidate-browse-page.test.tsx`.

## Visible coverage gaps

- There is no browser-level E2E framework in `package.json`, and `npm run test:e2e` still points to Vitest. The current "E2E" tests in `tests/e2e/flow.test.ts` and related files are flow-oriented integration tests, not browser automation.
- Because the suite runs in a Node environment and leans on `renderToStaticMarkup`, interactive client behaviors are only partially covered. Drag selection, file upload UX, Stripe Elements behavior, and toast timing/navigation side effects in `src/components/bookings/CandidateBookingRequestForm.tsx`, `src/components/profile/CandidateProfileEditor.tsx`, `src/components/auth/OnboardingForm.tsx`, and `src/components/ui/providers/RequestToastProvider.tsx` are not exercised in a real browser.
- Coverage output exists, but there is no minimum threshold in `vitest.config.ts`, so regressions can still land with materially lower coverage.
- Test infrastructure is still somewhat bespoke. Many files rebuild local request builders and mock factories instead of sharing utilities, which increases duplication across `tests/auth-onboarding-route.test.ts`, `tests/candidate-booking-hooks-timezone.test.ts`, and `tests/execute-tracked-action.test.ts`.
- Full-suite execution depends on external Stripe test configuration from `tests/setup/env.ts` and `tests/helpers/stripe-live.ts`, which raises CI and local onboarding friction.
- Operational scripts and build helpers are not visibly covered by tests, including `scripts/dev-queue.ts`, `scripts/ui/audit-class-tokens.mjs`, and `scripts/vercel-build.sh`.

## Planning notes

- When adding tests, match the existing fastest layer first:
  pure function test for utilities,
  direct module test for domain services,
  `Request`-driven test for route handlers,
  markup render test for server components.
- Add browser-driven tests only for genuinely interactive risk areas; the current suite is optimized for fast Node execution.
- Reuse `tests/e2e/fixtures.ts`, `tests/helpers/stripe-live.ts`, and `tests/mocks/zoom.ts` before inventing new fixture stacks.
- If a change touches UI interaction timing, drag behavior, uploads, or third-party widgets, treat that as a likely gap in the current test strategy and plan extra coverage explicitly.
