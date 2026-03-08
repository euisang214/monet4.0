# Stack

## System Shape

Monet is a single-package full-stack web app built around a Next.js App Router frontend/backend in `src/app`, shared domain logic in `lib`, Prisma-backed persistence in `prisma`, and a separate BullMQ worker process launched from `scripts/dev-queue.ts`.

## Languages And Runtimes

| Area | Evidence | Notes |
| --- | --- | --- |
| TypeScript | `src/**/*.ts(x)`, `lib/**/*.ts`, `prisma/*.ts`, `tests/**/*.ts(x)` | Primary implementation language across app, domain logic, queue workers, seeds, and tests. |
| JavaScript (ESM) | `eslint.config.mjs`, `scripts/ui/audit-class-tokens.mjs` | Used for lint configuration and one UI audit script. |
| Bash | `scripts/vercel-build.sh` | Production build wrapper for Prisma migration/generation and preview seeding. |
| SQL | `prisma/migrations/*/migration.sql` | Prisma-managed schema evolution. |
| JSON / YAML / TOML | `package.json`, `tsconfig.json`, `vercel.json`, `docker-compose.yml`, `supabase/config.toml` | Project, deployment, local infra, and Supabase CLI configuration. |

- Node.js is pinned to `20.19.0` in `.nvmrc` and constrained to `^20.19.0 || >=22.12.0` in `package.json`.
- The web runtime is Next.js server/client React code. No explicit Edge runtime declarations were found under `src/app`, so route handlers currently rely on the default Node runtime.
- The browser runtime is React 19 client components mixed into App Router pages under `src/app` and `src/components`.
- The background runtime is a separate Node process started with `npm run dev:queue`, implemented in `scripts/dev-queue.ts`.

## Frameworks And App Layers

| Layer | Evidence | Notes |
| --- | --- | --- |
| Next.js 16 App Router | `package.json`, `next.config.ts`, `src/app`, `src/proxy.ts` | Main application framework, route handlers, server rendering, and route protection. |
| React 19 | `package.json`, `src/components`, `src/app/**/*.tsx` | UI layer for pages, forms, dashboards, and shared components. |
| NextAuth v5 beta | `package.json`, `src/auth.ts`, `src/proxy.ts` | Auth stack for credentials plus OAuth provider sign-in. |
| Prisma ORM | `package.json`, `prisma/schema.prisma`, `lib/core/db.ts` | PostgreSQL access layer and generated client. |
| BullMQ | `package.json`, `lib/queues/index.ts`, `lib/queues/**/*.ts`, `scripts/dev-queue.ts` | Queueing for QC, notifications, payments, and booking lifecycle jobs. |
| Vitest | `package.json`, `vitest.config.ts`, `tests/` | Primary test runner for unit, integration, and Vitest-based e2e flows. |
| React Email + Nodemailer | `src/emails/*`, `lib/integrations/email.ts`, `lib/integrations/email-transport.ts` | Transactional email rendering and delivery. |
| CSS Modules + custom tokens | `src/app/globals.css`, `src/styles/tokens.css`, `src/components/**/*.module.css` | Styling is custom CSS/CSS Modules, not Tailwind-driven. |

## Major Dependencies In Active Use

| Dependency | Evidence | Role In The Stack |
| --- | --- | --- |
| `next`, `react`, `react-dom` | `package.json`, `src/app`, `src/components` | Core web framework and UI runtime. |
| `next-auth` | `src/auth.ts`, `src/proxy.ts`, `src/app/api/auth/*` | Sessions, OAuth sign-in, and credentials auth. |
| `bcryptjs` | `src/auth.ts` | Password verification for credentials login. |
| `prisma`, `@prisma/client` | `prisma/schema.prisma`, `lib/core/db.ts`, `lib/domain/**/*` | ORM, migrations, and DB client. |
| `bullmq` | `lib/queues/index.ts`, `lib/queues/**/*.ts`, `scripts/dev-queue.ts` | Background jobs backed by Redis. |
| `stripe`, `@stripe/react-stripe-js`, `@stripe/stripe-js` | `lib/integrations/stripe/*`, `src/components/bookings/CandidateBookingRequestForm.tsx` | Payments, payouts, and Stripe Elements. |
| `googleapis`, `google-auth-library` | `lib/integrations/calendar/google.ts`, `lib/integrations/email-transport.ts` | Google Calendar access and Gmail OAuth2 token handling. |
| `@supabase/supabase-js` | `lib/integrations/resume-storage.ts` | Resume upload/signing against Supabase Storage. |
| `nodemailer`, `@react-email/components`, `@react-email/render`, `ics` | `lib/integrations/email*.ts`, `src/emails/*` | Transactional email delivery plus ICS calendar invites. |
| `@anthropic-ai/sdk` | `lib/integrations/claude.ts`, `lib/domain/qc/services.ts` | LLM-assisted QC review. |
| `react-hook-form`, `@hookform/resolvers`, `zod` | `src/components/profile/*`, `src/app/api/**/*.ts`, `lib/types/*.ts` | Form state and runtime validation. |
| `class-variance-authority`, `clsx` | `src/components/ui/**/*`, `lib/ui/cn.ts` | Variant-based UI styling helpers. |
| `date-fns`, `date-fns-tz`, `use-debounce` | `lib/utils/timezones.ts`, `lib/integrations/email-calendar-invites.ts`, `src/app/admin/bookings/BookingSearch.tsx` | Date/time handling and minor UI behavior. |

## Code Organization That Matters For Planning

| Path | Purpose |
| --- | --- |
| `src/app` | App Router pages and API routes. |
| `src/components` | Client/server UI components and small frontend services/hooks. |
| `lib/domain` | Business logic for auth, bookings, payments, QC, users, and reviews. |
| `lib/role` | Role-oriented query/composition helpers for admin, candidate, and professional views. |
| `lib/integrations` | External-service adapters for Stripe, Zoom, Google, email, Supabase, and Anthropic. |
| `lib/queues` | Queue definitions, workers, and booking processors. |
| `lib/core` | Cross-cutting utilities such as Prisma, cron auth, rate limiting, and export helpers. |
| `prisma` | Schema, migrations, and seed scripts. |
| `scripts` | Operational scripts for worker startup, Vercel build, and UI audits. |
| `tests` | Unit, integration, and Vitest-based e2e coverage. |

## Configuration Files

| File | What It Configures |
| --- | --- |
| `package.json` | Scripts, Node engine range, and all app dependencies. |
| `package-lock.json` | npm lockfile; this is an npm-managed repo, not pnpm/yarn/bun. |
| `.nvmrc` | Local Node version pin (`20.19.0`). |
| `next.config.ts` | Next.js config; currently only sets the Turbopack root. |
| `tsconfig.json` | Strict TypeScript settings and path aliases for `@/*` and `@/lib/*`. |
| `eslint.config.mjs` | ESLint using `eslint-config-next` core-web-vitals + TypeScript presets. |
| `vitest.config.ts` | Node test environment, setup file, aliasing, and coverage settings. |
| `.env.example` | Canonical documented environment-variable contract. |
| `prisma/schema.prisma` | Prisma client generation, Postgres datasource, models, and one Prisma view. |
| `docker-compose.yml` | Local PostgreSQL 15 and Redis 7 containers. |
| `vercel.json` | Vercel build command and cron schedule definitions. |
| `supabase/config.toml` | Optional local Supabase CLI stack configuration. |
| `README.md` | Operational setup and deployment guidance. |

- No Tailwind config or PostCSS config files were found at the repo root.
- `next-env.d.ts` exists as standard Next.js type glue, but it is generated/supporting rather than a hand-maintained config surface.

## Build, Test, And Operational Scripts

| Command | Source | Practical Notes |
| --- | --- | --- |
| `npm run dev` | `package.json` | Starts the Next.js dev server. |
| `npm run dev:queue` | `package.json`, `scripts/dev-queue.ts` | Starts BullMQ workers and optionally registers repeatable jobs. |
| `npm run build` | `package.json` | Plain `next build`. |
| `npm run vercel-build` | `package.json`, `scripts/vercel-build.sh` | Runs Prisma generate, Prisma migrate deploy, optional preview seed, then build. |
| `npm run start` | `package.json` | Starts the production Next.js server. |
| `npm run lint` | `package.json`, `eslint.config.mjs` | ESLint against the Next.js config stack. |
| `npm run test` | `package.json`, `vitest.config.ts` | Main Vitest suite; some tests use live Stripe test-mode APIs. |
| `npm run test:watch` | `package.json` | Watch mode for Vitest. |
| `npm run test:coverage` | `package.json`, `vitest.config.ts` | V8 coverage to `coverage/`. |
| `npm run test:e2e` | `package.json`, `tests/e2e/` | Still Vitest-based; not Playwright/browser automation. |
| `npm run ui:audit` | `package.json`, `scripts/ui/audit-class-tokens.mjs` | Audits UI token/class usage. |
| `npm run seed`, `npm run seed:lite`, `npm run seed:full` | `package.json`, `prisma/seed.ts`, `prisma/seed-stripe.ts` | Seeds DB and performs real Stripe test-mode payment lifecycle calls. |

## Planning Notes

- The app is not operationally complete with `npm run dev` alone; background behavior depends on the separate worker in `scripts/dev-queue.ts`.
- Test realism is high for payments: `tests/setup/env.ts` and `tests/helpers/stripe-live.ts` expect real Stripe test keys, so CI/local planning must account for external API access.
- Deployment logic is already biased toward Vercel + separate worker + Postgres/Redis infra, per `vercel.json`, `scripts/vercel-build.sh`, and `README.md`.
- The repo is a single application, not a monorepo: there is one `package.json`, one Prisma schema, and one shared `tests/` tree.
