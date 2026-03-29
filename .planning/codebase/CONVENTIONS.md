# Quality Conventions

## Tooling baseline

- `tsconfig.json` runs in strict mode and defines the two import aliases used across the repo: `@/*` for `src/*` and `@/lib/*` for `lib/*`.
- `eslint.config.mjs` applies Next.js core-web-vitals and TypeScript linting, but there is no repo formatter config. Formatting is not fully normalized.
- In practice, preserve the surrounding file style instead of reformatting broadly. For example, `src/components/profile/CandidateProfileEditor.tsx` is semicolon-heavy and double-quoted, while `lib/core/api-helpers.ts` and `src/proxy.ts` use a leaner no-semicolon style.

## Naming and file layout

- App Router conventions are standard Next.js: route entry points live in `src/app/**/page.tsx`, layouts in `src/app/**/layout.tsx`, and API handlers in `src/app/api/**/route.ts`.
- React components use PascalCase file names in `src/components/**`, with CSS Modules beside them when needed, such as `src/components/browse/ListingCard.tsx` and `src/components/browse/ListingCard.module.css`.
- Hooks use `use...` names and live near their domain, for example `src/components/profile/shared/useTrackedProfileSubmit.ts` and `src/components/bookings/hooks/useTrackedCandidateBookingActions.ts`.
- Client-side fetch wrappers use `*Api` naming under `src/components/**/services/`, for example `src/components/bookings/services/candidateBookingApi.ts` and `src/components/admin/services/adminMutationApi.ts`.
- Server-side modules under `lib/**` are mostly kebab-case and grouped by responsibility: `lib/core/*`, `lib/domain/*`, `lib/role/*`, `lib/integrations/*`, `lib/shared/*`, and `lib/types/*`.
- Route and navigation strings are centralized in `lib/shared/routes.ts`. New user-facing or API paths should extend that map instead of duplicating literals.

## Component and service patterns

- The dominant split is server data loading in pages plus client interaction in components. A representative path is `src/app/candidate/browse/page.tsx` calling `lib/role/candidate/browse.ts`, then rendering `src/components/browse/ListingCard.tsx`.
- Shared UI is intentionally layered. `src/components/ui/README.md` defines `primitives/` for low-level controls and `composites/` for assembled blocks, and explicitly keeps business logic out of `src/components/ui/`.
- `src/components/ui/index.ts` is the public export surface for reusable UI. New shared primitives should usually be exported there instead of imported from deep file paths.
- Interactive mutations usually follow a three-step pattern:
  `src/components/**/services/*.ts` for raw `fetch` calls,
  `src/components/**/hooks/useTracked*.ts` for toast/router orchestration,
  `src/components/ui/actions/executeTrackedAction.ts` for the common tracked-request runtime.
- Profile editing is built from shared schemas and adapters rather than duplicated form logic. The core pieces are `src/components/profile/shared/profileEditorSchemas.ts`, `src/components/profile/shared/profileFormAdapters.ts`, `src/components/profile/CandidateProfileEditor.tsx`, and `src/components/profile/ProfessionalProfileEditor.tsx`.
- Service shape is mostly object-literal modules such as `lib/role/admin/bookings.ts`, `lib/role/candidate/browse.ts`, `lib/domain/users/profile-service.ts`, and `lib/domain/users/onboarding-service.ts`. Plain exported functions are still used when composition is simpler, for example `lib/domain/users/service.ts` and `lib/domain/users/profile-submit-service.ts`.

## Validation patterns

- Validation is Zod-first. Shared domain input schemas live in `lib/types/profile-schemas.ts` and `lib/types/booking-schemas.ts`.
- Higher-level payload schemas usually wrap those shared schemas instead of redefining rules from scratch. The clearest example is `lib/domain/users/profile-upsert-service.ts`, which composes `ExperienceSchema` and `EducationSchema`.
- Form-side validation mirrors server-side validation instead of diverging from it. `src/components/profile/shared/profileEditorSchemas.ts` reuses base Zod schemas with `safeParse` during `superRefine`.
- API handlers validate in two main ways:
  `withRoleBodyContext` and related helpers from `lib/core/api-helpers.ts`,
  or manual `safeParse` calls inside the route handler, as in `src/app/api/professional/onboarding/route.ts`.
- Normalization before persistence is a recurring implementation choice. The main patterns are string trimming, deduping comma-separated lists, timezone normalization, cents conversion, and date coercion in `lib/domain/users/profile-upsert-service.ts`, `src/components/profile/shared/profileFormAdapters.ts`, and `lib/utils/supported-timezones.ts`.
- For planning work, prefer adding a schema close to the boundary that first receives user input, then normalize once before persistence.

## Error handling

- Domain logic commonly throws plain `Error`, but booking transitions also define targeted error types in `lib/domain/bookings/errors.ts`.
- `lib/core/api-helpers.ts` is the main normalization layer for API errors. It handles auth wrappers, Zod validation failures, and booking transition status mapping through `jsonValidationError`, `jsonError`, and `jsonHandledError`.
- Not every route uses the helper layer yet. `src/app/api/shared/settings/route.ts` and `src/app/api/professional/onboarding/route.ts` still do manual `try/catch`, `console.error`, and inline `Response.json(...)` error responses.
- Error payloads are structurally consistent at a high level, but naming and casing are not fully uniform. For example, `src/app/api/candidate/bookings/[id]/dispute/route.ts` returns `internal_error`, while `src/app/api/professional/requests/[id]/confirm-and-schedule/route.ts` uses `Internal Error` and `Validation Error`.
- Client fetch wrappers usually parse `{ error }` and rethrow a local `Error`, as shown in `src/components/bookings/services/candidateBookingApi.ts` and `src/components/auth/services/verificationApi.ts`.
- There is extensive `console.error` and `console.info` usage across API, integration, and queue code, but no centralized logger. New work should match the existing style unless there is an explicit logging refactor.

## Recurring implementation choices

- RBAC is enforced in layers:
  `src/proxy.ts` gates page navigation,
  `src/auth.ts` enriches session and token state,
  `lib/core/api-helpers.ts` protects role-scoped API handlers.
- Database access goes through the Prisma singleton in `lib/core/db.ts`. Multi-step writes prefer `prisma.$transaction(...)`, especially in `lib/domain/users/service.ts`.
- Nested profile data is replaced wholesale on update rather than diffed in place. `lib/domain/users/service.ts` deletes owned experience and education rows, then recreates them.
- Queue-backed side effects are treated as first-class architecture. Booking, payment, QC, and notification jobs live under `lib/queues/*`, and request handlers often enqueue work instead of finishing everything inline.
- Pagination uses cursor-based patterns with `skip: 1` fallback logic, visible in `lib/role/candidate/browse.ts`, `lib/role/candidate/chats.ts`, and `lib/role/professional/dashboard.ts`.
- Shared UI prefers tokenized primitives over raw styling. `src/components/ui/README.md` points new work toward `src/styles/tokens.css`, `src/styles/base.css`, and existing UI primitives, while treating `src/styles/utilities-legacy.css` as compatibility-only.

## Planning notes

- Preserve file-local formatting and existing layer boundaries. The repo is architecture-consistent but formatting-inconsistent.
- Reuse `lib/shared/routes.ts`, `lib/core/api-helpers.ts`, and the existing `useTracked*` mutation flow before adding new abstractions.
- When adding validation, mirror the current pattern: base Zod schema in `lib/types/**`, boundary schema near the route or form, then explicit normalization before Prisma writes.
- When touching older routes, expect to find both helper-driven and manual auth/error handling styles in the same area. Favor the helper style for new code, but do not assume the whole folder already uses it.
