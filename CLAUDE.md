# CLAUDE.md - Monet 3.0 Codebase Guide for AI Assistants

> **Version**: 0.3.0

> **Purpose**: Comprehensive guide for AI assistants working on the Monet marketplace platform

> [!IMPORTANT]
> **Two-Process Development Required**
> 
> Always run BOTH processes: `npm run dev` (Next.js) AND `npm run dev:queue` (BullMQ worker).
> Background jobs (QC, emails, payouts) won't run without the worker process.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Directory Structure](#directory-structure)
5. [Development Setup](#development-setup)
6. [Key Conventions](#key-conventions)
7. [Database Schema](#database-schema)
8. [API Routes](#api-routes)
9. [Authentication & Authorization](#authentication--authorization)
10. [Important Workflows](#important-workflows)
11. [Testing](#testing)
12. [Code Patterns](#code-patterns)
13. [Common Tasks](#common-tasks)
14. [Troubleshooting](#troubleshooting)

---

## Project Overview

**Monet 3.0** is a full-stack marketplace platform that connects **Candidates** (job seekers) with **Professionals** (industry experts) for paid consultation calls. The platform is a two-sided marketplace (between Candidates and Professionals) with distinct portals for Candidates, Professionals, and Admins.

### Core Features

- **Anonymous Professional Discovery**: Candidates browse redacted professional profiles
- **Booking Workflow**: Request (with payment authorization) → Accept (captures funds) → Schedule → Call → Feedback
- **Payment Processing**: Stripe Connect with separate charges and transfers pattern (20% platform fee)
  - Uses "Separate Charges and Transfers" to enable escrow/gating (charge platform, transfer after QC passes)
  - Funds held on platform until QC validation completes
- **Quality Control**: Automated feedback validation with payout gating
- **Calendar Integration**: Google Calendar sync for availability
- **Calendar Slot Picker**: Weekly 30-minute grid for candidate availability (click/drag), with professional single-slot selection
- **Video Meetings**: Zoom meetings created server-side
- **Background Jobs**: BullMQ for nudges, QC checks, and notifications
- **Multi-role Access**: Separate dashboards for each user role

### Key Business Rules

- **Call Duration**: 30 minutes (configurable via `CALL_DURATION_MINUTES`)
- **Platform Fee**: 20% of booking price
- **Cancellation Policy**: 6-hour window before scheduled call
- **QC Requirements**:
  - Minimum 200 words
  - 3 or more action items
  - 3 star ratings (content, delivery, value)
- **Payout Gating**: Payments released only after QC passes

---

## Tech Stack

### Frontend
- **Framework**: Next.js 
- **Language**: TypeScript (strict mode)
- **UI Library**: React 
- **UI Authoring**: Hand-authored React components (`tsx` + semantic HTML) in-repo
- **Styling**: Custom CSS (global tokens/utilities + component-scoped CSS Modules)
- **Icons**: Lucide React 
- **Date Handling**: date-fns 
- **Payment UI**: @stripe/react-stripe-js 

### Backend
- **Runtime**: Node.js with TypeScript
- **ORM**: Prisma 6 + Prisma Accelerate extension
- **Database**: Supabase (PostgreSQL) with SQL views
- **Authentication**: NextAuth v5 (JWT strategy)
- **LLM**: Claude API (Anthropic) for automated QC validation
- **Job Queue**: BullMQ + Redis (ioredis)
- **Payment Processing**: Stripe (Connect with Separate Charges and Transfers)
- **Video**: Zoom Server-to-Server OAuth
- **Email**: Nodemailer + AWS SES
- **File Storage**: Supabase Storage (private bucket + signed URLs)
- **Validation**: Zod

### Deployment
- **Platform**: Vercel (Next.js optimized)
- **Database**: Supabase (managed PostgreSQL)
- **Redis**: Upstash or Railway (for BullMQ)

### DevOps & Testing
- **Testing**: Vitest 3.2.4 (unit + E2E)
- **Package Manager**: npm
- **Build Tool**: tsx 4.19.2 for TypeScript execution
- **Local Dev**: Docker Compose (Postgres + Redis)

---

## Architecture

### Application Type
**Full-Stack Monolith** with Server-Side Rendering

- **Frontend**: Next.js App Router with React Server Components
- **Backend**: Next.js API routes (RESTful)
- **Database**: Single PostgreSQL instance
- **Background Jobs**: Separate worker process via BullMQ

### Key Architectural Patterns

1. **App Router Structure**: Route-based file organization
2. **Server Components First**: Client components only when needed
3. **API Route Handlers**: RESTful endpoints under `/app/api/*`
4. **Service Layer**: Business logic in `/lib/*` utilities
5. **Repository Pattern**: Prisma as data access layer
6. **JWT Sessions**: Stateless authentication
7. **RBAC**: Role-based route and API protection
8. **Queue-based Background Jobs**: Async processing for long-running tasks

### Data Flow

```
Browser → Next.js SSR → Prisma → PostgreSQL
   ↓
Browser → API Routes → Service Layer → Prisma → PostgreSQL
   ↓
Background Jobs → BullMQ → Redis → Service Layer → Prisma
```

### Custom Component UI Layer

- **Next.js** owns routing, auth gating, data fetching, and API routes
- **UI Components** are authored directly in `src/components/` and grouped by domain + UI layer
- **Pattern**: Server Component fetches data → passes serializable props to route-local/shared client components
- **Booking Calendar Pattern**: presentation (`WeeklySlotCalendar`) stays thin while interaction/data logic lives in `components/bookings/hooks/*` and `components/bookings/services/*`

> [!NOTE]
> There is no generated UI pipeline. Frontend components are long-lived custom implementations (HTML/CSS + TypeScript).

### Three User Portals

1. **Candidate Portal** (`/candidate/*`)
   - Browse professionals (anonymized)
   - Request bookings
   - Manage availability
   - View booking history

2. **Professional Portal** (`/professional/*`)
   - View booking requests
   - Accept/decline requests
   - Submit feedback
   - View earnings

3. **Admin Portal** (`/admin/*`)
   - User management
   - Booking oversight
   - Payment/payout management
   - CSV exports
   - Audit logs

---

## Directory Structure

``` 
monet gemini/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (public)/                # Public routes (landing, pricing, etc.)
│   │   ├── candidate/               # Candidate portal
│   │   │   ├── dashboard/
│   │   │   ├── browse/
│   │   │   ├── professionals/       # Professional details + booking entry at /candidate/professionals/[id]/book
│   │   │   ├── bookings/            # Candidate booking details + reschedule pages
│   │   │   ├── availability/
│   │   │   ├── history/
│   │   │   └── settings/
│   │   ├── professional/            # Professional portal
│   │   │   ├── dashboard/
│   │   │   ├── requests/            # Request list + [id]/confirm-and-schedule + [id]/reschedule
│   │   │   ├── feedback/
│   │   │   ├── earnings/
│   │   │   └── settings/
│   │   ├── admin/                   # Admin portal
│   │   │   ├── users/
│   │   │   ├── bookings/
│   │   │   ├── payments/
│   │   │   └── feedback/
│   │   └── api/                     # API routes (organized by role)
│   │       ├── auth/                # Authentication (root for NextAuth)
│   │       ├── professional/        # Professional-specific endpoints
│   │       ├── candidate/           # Candidate-specific endpoints
│   │       ├── shared/              # Shared/common endpoints
│   │       └── admin/               # Admin-only endpoints
│   ├── components/                  # Shared React components (organized by domain + UI layer)
│   │   ├── auth/
│   │   ├── bookings/               # Booking-related UI wrappers + calendar rendering
│   │   │   ├── WeeklySlotCalendar.tsx
│   │   │   ├── ConfirmBookingForm.tsx
│   │   │   ├── ConfirmRescheduleForm.tsx
│   │   │   ├── calendar/           # Slot-grid primitives (types + utilities)
│   │   │   │   ├── types.ts
│   │   │   │   └── slot-utils.ts
│   │   │   ├── hooks/              # Calendar state machines and orchestration hooks
│   │   │   │   ├── useCandidateWeeklySlotSelection.ts
│   │   │   │   ├── useProfessionalWeeklySlotSelection.ts
│   │   │   │   ├── useCandidateGoogleBusy.ts
│   │   │   │   ├── useCandidateBookingRequest.ts
│   │   │   │   ├── useCandidateRescheduleRequest.ts
│   │   │   │   └── useProfessionalRescheduleActions.ts
│   │   │   └── services/           # Client-side API access used by booking hooks
│   │   │       ├── candidateBookingApi.ts
│   │   │       └── professionalRescheduleApi.ts
│   │   ├── browse/
│   │   ├── dashboard/              # Dashboard components
│   │   ├── feedback/
│   │   ├── layout/
│   │   └── ui/                     # Shared custom UI primitives/composites
│   │       ├── primitives/
│   │       │   └── Button/
│   │       │       ├── Button.tsx
│   │       │       └── index.ts
│   │       ├── composites/
│   │       │   └── EmptyState/
│   │       │       ├── EmptyState.tsx
│   │       │       └── index.ts
│   │       ├── index.ts
│   │       └── README.md
│   ├── types/                       # TypeScript type definitions
│   ├── auth.ts                      # NextAuth configuration
│   └── middleware.ts                # Auth middleware
├── lib/                             # Server-side utilities
│   ├── domain/                      # Domain services (shared business logic)
│   │   ├── bookings/
│   │   │   ├── transitions.ts       # Centralized state machine
│   │   │   ├── history.ts
│   │   │   └── upcoming.ts
│   │   ├── payments/
│   │   ├── users/
│   │   └── qc/
│   ├── role/                        # Role-specific facades (thin wrappers calling domain services)
│   │   ├── professional/
│   │   │   ├── dashboard.ts
│   │   │   ├── earnings.ts
│   │   │   ├── feedback.ts
│   │   │   └── requests.ts
│   │   └── candidate/
│   │       ├── browse.ts            # Professional discovery logic
│   │       ├── bookings.ts          # Booking requests
│   │       └── availability.ts      # Candidate availability
│   ├── shared/                      # Shared utilities
│   │   ├── bookings/
│   │   │   ├── history.ts
│   │   │   └── upcoming.ts
│   │   ├── availability.ts
│   │   ├── qc.ts
│   │   ├── audit.ts
│   │   └── time-slot.ts
│   ├── integrations/                # Third-party service integrations
│   │   ├── stripe/
│   │   │   ├── index.ts
│   │   │   └── confirm.ts
│   │   ├── calendar/
│   │   │   └── google.ts
│   │   ├── zoom.ts
│   │   ├── email.ts
│   │   └── s3.ts
│   ├── core/                        # Core infrastructure
│   │   ├── db.ts                    # Prisma client singleton
│   │   ├── api-helpers.ts           # API auth and helpers
│   │   ├── flags.ts                 # Feature flags
│   │   ├── rate-limit.ts            # Rate limiting
│   │   └── admin-export.ts          # Admin CSV exports
│   ├── utils/                       # Pure utilities
│   │   ├── date.ts
│   │   ├── timezones.ts
│   │   └── profileOptions.ts
│   └── queues/                      # BullMQ workers (organized by domain)
│       ├── index.ts                 # Queue exports and shared config
│       ├── qc.ts                    # QC validation jobs
│       ├── notifications.ts         # Email notification jobs
│       ├── payments.ts              # Payment/payout jobs
│       └── bookings.ts              # Booking expiry jobs
├── prisma/
│   ├── schema.prisma                # Database schema
│   ├── migrations/                  # Migration history
│   └── seed.ts                      # Seed data
├── tests/                           # Test files
│   ├── availability.test.ts
│   ├── cancellations.test.ts
│   ├── qc-gating.test.ts
│   ├── zoom.test.ts
│   └── e2e/
│       └── flow.test.ts
├── scripts/
│   └── dev-queue.ts                 # Queue worker script
├── public/                          # Static assets (icons/images)
├── package.json
├── tsconfig.json
├── .env.example
├── docker-compose.yml
└── README.md
```

> **Note**: Most list views have corresponding `[id]` routes for detail pages (e.g., `professional/requests/[id]`).

### Important Path Aliases

- `@/*` maps to `./src/*` (defined in `tsconfig.json`)
- `@/lib/*` resolves via the above alias since `lib/` is at repo root and symlinked/configured

**Usage**: `import { prisma } from '@/lib/core/db'` instead of relative paths

**Configuration**: `lib/` is at repo root (not under `src/`). The path alias `@/lib/*` maps to `./lib/*` via a second alias in `tsconfig.json`.

### lib/ Organization Philosophy

The `lib/` directory uses a **hybrid approach**:

1. **`lib/domain/*`**: Contains domain services organized by entity (bookings, payments, users, qc). This is where shared business logic lives.

2. **`lib/role/*`**: Contains thin facades that call domain services. These are for role-specific API routes and provide a simpler interface.

3. **Why this pattern**: 
   - Domain services prevent code duplication
   - Role facades allow role-specific customizations
   - API routes stay thin by delegating to these layers

---

## Development Setup

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Redis 6+
- npm

### Quick Start

```bash
npm install
cp .env.example .env
# Edit .env with your DB/Stripe/etc values

# Start Docker services (optional - if using local DB/Redis)
docker compose up -d

npx prisma migrate dev
npm run seed
npm run dev        # Terminal 1
npm run dev:queue  # Terminal 2
```

### Seeded Test Users

After running `npm run seed`, these users are available:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@monet.local | admin123! |
| Candidate | cand1@monet.local | cand123! |
| Professional | pro1@monet.local | pro123! |

### Development URLs

- App: http://localhost:3000
- Candidate Dashboard: http://localhost:3000/candidate/dashboard
- Professional Dashboard: http://localhost:3000/professional/dashboard
- Admin Portal: http://localhost:3000/admin/bookings

### NPM Scripts

```bash
npm run dev          # Start Next.js dev server (port 3000)
npm run dev:queue    # Start BullMQ background worker
npm run build        # Production build
npm run start        # Production server
npm run seed         # Run database seed
npm run test         # Run unit tests
npm run test:e2e     # Run E2E tests
```

### Two-Process Development

⚠️ **IMPORTANT**: Always run **both** processes during development:

1. **Main App**: `npm run dev` (Next.js server)
2. **Queue Worker**: `npm run dev:queue` (Background jobs)

The queue worker handles:
- QC validation jobs
- Email notifications
- Nudge reminders
- Payout processing

---

## Key Conventions

### File Naming

- **Components**: PascalCase (e.g., `ProfileCard.tsx`)
- **Utilities**: kebab-case (e.g., `get-availability.ts`)
- **API Routes**: kebab-case (e.g., `route.ts` in folder structure)
- **Types**: PascalCase (e.g., `BookingTypes.ts`)

### Code Style

- **TypeScript Strict Mode**: Enabled (`strict: true`)
- **No Implicit Any**: All types must be explicit
- **Path Aliases**: Use `@/*` for imports from `src/`
- **Async/Await**: Preferred over `.then()` chains
- **Error Handling**: Always catch and handle errors appropriately

### Component Organization

1. **Route Collocation**: Forms and components in same directory as pages
2. **Shared Components**: `/src/components` for reusable UI
3. **"use client" Directive**: Required for interactive components (hooks, browser APIs, event-heavy UI)
4. **Server Components**: Default for routes and data-fetching components unless interactivity is required

**Route-Colocated Component Boundaries**:

Route-colocated components should contain ONLY:
- ✅ UI rendering and local state
- ✅ Event handlers that call passed-in callbacks
- ✅ Conditional rendering logic

Route-colocated components must NOT contain:
- ❌ API calls (use server actions or page-level data fetching)
- ❌ Validation logic (use shared Zod schemas in `/lib/`)
- ❌ Business logic (use domain services in `/lib/domain/`)
- ❌ Reusable UI elements (move to `/src/components/`)

### Custom UI Conventions

1. **No Generated UI**: Build frontend components directly in this repo (`tsx` + custom CSS)
2. **Layered UI Structure**: Keep reusable atoms in `components/ui/primitives`, composed blocks in `components/ui/composites`
3. **Styling Strategy**: Use component-scoped CSS Modules first; keep `app/globals.css` for tokens/utilities/reset only
4. **Composition Pattern**: Shared components handle presentation; route/page files own data access and orchestration

### API Response Patterns

**Success Response**:
```typescript
return Response.json({ data: result })
```

**Error Response**:
```typescript
return Response.json({ error: 'error_code' }, { status: 400 })
```

**Common Error Codes**:
- `unauthorized` - 401
- `forbidden` - 403
- `not_found` - 404
- `validation_error` - 400
- `internal_error` - 500

---

## Database Schema

### Schema Inventory

| Model | Purpose | Status |
|-------|---------|--------|
| User | Core user account | ✅ Defined |
| Booking | Consultation booking record | ✅ Defined |
| Payment | Stripe payment tracking | ✅ Defined |
| Payout | Professional payout tracking | ✅ Defined |
| CallFeedback | Post-call feedback from professional | ✅ Defined |
| ProfessionalProfile | Professional listing data | ✅ Defined |
| CandidateProfile | Candidate resume and interests | ✅ Defined |
| ProfessionalRating | Candidate review of professional | ✅ Defined |
| OAuthAccount | OAuth provider tokens | ✅ Defined |
| Availability | User availability slots | ✅ Defined |
| Verification | Email verification tokens | ✅ Defined |
| PasswordResetToken | Password reset tokens | ✅ Defined |
| AuditLog | State transition audit trail | ✅ Defined |
| Dispute | Booking disputes | ✅ Defined |

---

### Core Models

#### User
```prisma
model User {
  id                      String   @id @default(cuid())
  email                   String   @unique
  hashedPassword          String?
  role                    Role     // CANDIDATE | PROFESSIONAL | ADMIN
  googleCalendarConnected Boolean  @default(false)
  linkedinConnected       Boolean  @default(false)
  corporateEmailVerified  Boolean  @default(false)
  timezone                String   @default("UTC")
  stripeCustomerId        String?  // For candidates
  stripeAccountId         String?  // For professionals (Connect)
  // ... relations
}
```

#### Booking
```prisma
model Booking {
  id               String        @id @default(cuid())
  candidateId      String
  professionalId   String
  status           BookingStatus // draft | requested | declined | expired | accepted | cancelled | completed | completed_pending_feedback | refunded | reschedule_pending
  priceCents       Int?          // Price in cents (e.g., 10000 = $100.00)
  startAt          DateTime?
  endAt            DateTime?
  expiresAt        DateTime?     // For request expiration (120 hours from creation)
  declineReason    String?       // Professional's reason for declining
  paymentDueAt     DateTime?     // Checkout deadline (if using pay-after-accept variant)
  zoomMeetingId    String?
  zoomJoinUrl      String?
  timezone         String        @default("UTC")
  
  // Join tracking
  candidateJoinedAt    DateTime?
  professionalJoinedAt DateTime?
  attendanceOutcome    AttendanceOutcome?  // Set by no-show detection job
  
  // Late cancellation tracking
  candidateLateCancellation Boolean @default(false)  // True if payout released without QC (candidate no-show/late cancel)
  
  // ... relations
}
```

#### Payment
```prisma
model Payment {
  id                  String        @id @default(cuid())
  bookingId           String        @unique
  
  // Amounts (all in cents)
  amountGross         Int           // Total amount charged
  platformFee         Int           // Platform fee in cents
  refundedAmountCents Int           @default(0) // Amount refunded (0 = none, partial, or full)
  
  // Stripe identifiers
  stripePaymentIntentId String      @unique // Stripe PaymentIntent ID
  stripeRefundId        String?     // Refund ID if refunded
  
  // Lifecycle status
  status              PaymentStatus // held | released | partially_refunded | refunded
  
  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt
  timezone            String        @default("UTC")
  
  booking             Booking       @relation(...)
  
  @@unique([stripePaymentIntentId])
  @@index([status])
}
```

**Usage**: Tracks payment state through the booking lifecycle. `refundedAmountCents` enables partial refunds - if less than `amountGross`, status is `partially_refunded`; if equal, status is `refunded`.

#### Payout
```prisma
model Payout {
  id                 String       @id @default(cuid())
  bookingId          String       @unique
  proStripeAccountId String       // Professional's Stripe Connect account
  
  // Amount (in cents)
  amountNet          Int          // Net amount after fees
  
  // Status
  status             PayoutStatus // pending | paid | blocked
  reason             String?      // Reason if blocked
  
  // Stripe tracking
  stripeTransferId   String?      // Populated after transfer executes
  paidAt             DateTime?    // When transfer completed
  
  createdAt          DateTime     @default(now())
  updatedAt          DateTime     @updatedAt
  timezone           String       @default("UTC")
  
  booking            Booking      @relation(...)
}
```

**Usage**: Tracks professional payouts after QC validation. Created when QC passes with status `pending`, updated to `paid` after Stripe transfer completes.

#### CallFeedback
```prisma
model CallFeedback {
  bookingId       String   @id
  text            String   // Detailed feedback (min 200 words)
  summary         String?  // Brief summary for QC LLM reference
  actions         String[] // 3 or more action items
  wordCount       Int      // Calculated word count
  contentRating   Int      // 1-5 stars (content quality)
  deliveryRating  Int      // 1-5 stars (delivery quality)
  valueRating     Int      // 1-5 stars (overall value)
  qcStatus        QCStatus // passed | revise | failed | missing
  submittedAt     DateTime
  // ... relations

  @@map("Feedback") // Maps to existing table
}
```

**Note**: Model renamed from `Feedback` to `CallFeedback` for clarity. This is the feedback that professionals provide to candidates after calls.

---

### Profile Models

#### ProfessionalProfile
```prisma
model ProfessionalProfile {
  userId            String       @id
  employer          String       // Current company
  title             String       // Job title
  bio               String       // Professional bio
  priceCents        Int          // Hourly rate in cents (e.g., 10000 = $100.00)
  availabilityPrefs Json         @default("{}")
  verifiedAt        DateTime?    // Corporate email verification timestamp
  corporateEmail    String       // Work email for verification
  timezone          String       @default("UTC")
  
  // Profile details
  experience        Experience[]
  education         Education[]
  interests         String[]
  activities        Experience[]
  
  user              User         @relation(...)
  
  @@index([employer])
  @@index([priceCents])
}
```

**Usage**: Professional listing data displayed on browse/search pages. Linked to User via userId as primary key.

#### CandidateProfile
```prisma
model CandidateProfile {
  userId     String       @id
  resumeUrl  String?      // Supabase Storage URL to uploaded resume
  interests  String[]
  activities Experience[]
  experience Experience[]
  education  Education[]
  
  user       User         @relation(...)
}
```

#### Experience
```prisma
model Experience {
  id             String               @id @default(cuid())
  
  // Institution details
  company        String               // Company/organization name
  location       String?              // City, State/Country
  
  // Tenure
  startDate      DateTime
  endDate        DateTime?            // null = currently employed
  isCurrent      Boolean              @default(false)
  
  // Primary position (final/current role if promoted)
  title          String               // Job title
  description    String?              // Role description
  
  // Position history (for promotions/role changes within same company)
  // JSON array: [{ title: string, startDate: string, endDate: string }]
  positionHistory Json                @default("[]")
  
  // Relations (polymorphic - belongs to either Professional or Candidate)
  professional   ProfessionalProfile? @relation("ProfessionalExperience", fields: [professionalId], references: [userId], onDelete: Cascade)
  professionalId String?
  candidate      CandidateProfile?    @relation("CandidateExperience", fields: [candidateId], references: [userId], onDelete: Cascade)
  candidateId    String?
  
  @@index([professionalId])
  @@index([candidateId])
}
```

**Usage**: Work experience entries. `positionHistory` tracks role changes during a single company tenure (e.g., promoted from Analyst to Senior Analyst). If no promotions, leave as empty array `[]`.

**Example positionHistory:**
```json
[
  { "title": "Analyst", "startDate": "2020-01-15", "endDate": "2021-06-01" },
  { "title": "Senior Analyst", "startDate": "2021-06-01", "endDate": null }
]
```

#### Education
```prisma
model Education {
  id             String               @id @default(cuid())
  
  // Institution details
  school         String               // University/school name
  location       String?              // City, State/Country
  
  // Tenure
  startDate      DateTime
  endDate        DateTime?            // null = currently enrolled
  isCurrent      Boolean              @default(false)
  
  // Degree/program details
  degree         String               // e.g., "Bachelor of Science", "MBA"
  fieldOfStudy   String               // e.g., "Computer Science", "Finance"
  gpa            Float?               // Optional GPA
  honors         String?              // e.g., "Magna Cum Laude"
  
  // Activities during education
  activities     String[]             // Clubs, sports, organizations
  
  // Relations (polymorphic)
  professional   ProfessionalProfile? @relation("ProfessionalEducation", fields: [professionalId], references: [userId], onDelete: Cascade)
  professionalId String?
  candidate      CandidateProfile?    @relation("CandidateEducation", fields: [candidateId], references: [userId], onDelete: Cascade)
  candidateId    String?
  
  @@index([professionalId])
  @@index([candidateId])
}
```

**Usage**: Education entries with degree, field of study, and optional GPA/honors. `activities` captures extracurricular involvement during that tenure.

---

### OAuth & Authentication Models

#### OAuthAccount
```prisma
model OAuthAccount {
  id                String    @id @default(cuid())
  userId            String
  provider          String    // "google" | "linkedin"
  providerAccountId String
  
  accessToken       String?
  refreshToken      String?
  expiresAt         DateTime?
  scope             String?
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  timezone          String    @default("UTC")
  
  user              User      @relation(...)
  
  @@unique([provider, providerAccountId])
}
```

**Usage**: Custom OAuth token storage (not using NextAuth Prisma Adapter default). Required because project uses JWT strategy but needs to persist tokens for Google Calendar API access. Tokens are upserted on each OAuth sign-in.

---

### Scheduling Models

#### Availability
```prisma
model Availability {
  id       String   @id @default(cuid())
  userId   String
  start    DateTime // Slot start time (UTC)
  end      DateTime // Slot end time (UTC)
  busy     Boolean  @default(false) // true = blocked, false = available
  timezone String   @default("UTC")
  
  user     User     @relation(...)
  
  @@index([userId, start])
}
```

**Usage**: Stores user availability slots. Synced from Google Calendar busy times and manual preferences. Used in booking scheduling flow.

---

### Audit & Logging Models

#### AuditLog
```prisma
model AuditLog {
  id          String   @id @default(cuid())
  actorUserId String?  // null for system actions
  entity      String   // "Booking", "Payment", "Payout", "Feedback"
  entityId    String
  action      String   // "booking_declined", "qc_status_override", etc.
  metadata    Json     @default("{}") // previousState, newState, reason, etc.
  createdAt   DateTime @default(now())
  timezone    String   @default("UTC")
  
  actor       User?    @relation(...)
}
```

**Usage**: Audit trail for state transitions and admin actions. Required for compliance and debugging. All state machine transitions should log here.

#### Dispute
```prisma
model Dispute {
  id           String        @id @default(cuid())
  bookingId    String        @unique
  initiatorId  String        // User who initiated the dispute
  reason       DisputeReason // no_show, quality, misrepresentation, other
  description  String        // Detailed description
  status       DisputeStatus // open, under_review, resolved
  resolution   String?       // Admin resolution notes
  resolvedAt   DateTime?
  resolvedById String?       // Admin who resolved
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  timezone     String        @default("UTC")
  
  booking      Booking       @relation(fields: [bookingId], references: [id])
  initiator    User          @relation("DisputeInitiator", fields: [initiatorId], references: [id])
  resolvedBy   User?         @relation("DisputeResolver", fields: [resolvedById], references: [id])
  
  @@index([status])
  @@index([bookingId])
}
```

**Usage**: Tracks disputes raised by candidates (no-show, quality issues) or escalated from QC failures. Admin reviews and resolves by issuing refund, partial refund, or dismissing.

### Enums

```prisma
enum Role {
  CANDIDATE
  ADMIN
  PROFESSIONAL
}

enum BookingStatus {
  draft
  requested
  declined                      // Professional declined the request
  expired                       // Request expired (120-hour timeout, no response)
  accepted
  accepted_pending_integrations // Accepted but Zoom/calendar provisioning in progress
  reschedule_pending            // Reschedule requested, awaiting time selection
  dispute_pending               // Dispute raised, awaiting admin review
  cancelled
  completed
  completed_pending_feedback
  refunded
}

// State transitions:
// requested → declined (professional declines)
// requested → expired (120-hour timeout with no response)
// requested → accepted (professional accepts)
// accepted → accepted_pending_integrations (Zoom/calendar provisioning started)
// accepted_pending_integrations → accepted (provisioning complete or failed with manual fallback)
// accepted → reschedule_pending (either party requests reschedule)
// reschedule_pending → accepted (new time confirmed or reschedule rejected)
// accepted → cancelled (either party cancels)
// accepted → dispute_pending (candidate disputes or QC fails)
// dispute_pending → refunded (admin issues refund)
// dispute_pending → completed (admin dismisses dispute)
// accepted → completed_pending_feedback (call ends)
// completed_pending_feedback → completed (feedback submitted, QC passed)
// any → refunded (refund processed)

enum PaymentStatus {
  authorized          // Funds authorized on card but not captured (pre-accept)
  cancelled           // Authorization cancelled (professional declined, no capture occurred)
  capture_failed      // Capture attempted but failed (expired auth, declined card)
  held                // Funds captured and in escrow (post-accept)
  released            // Transferred to professional (after QC passes)
  partially_refunded  // Some funds returned to candidate (refundedAmountCents < amountGross)
  refunded            // All funds returned to candidate (refundedAmountCents = amountGross)
}

// Payment state transitions:
// authorized → cancelled (professional declines before capture)
// authorized → capture_failed (capture attempted but failed)
// authorized → held (capture succeeds after professional accepts)
// capture_failed → authorized (candidate updates payment, re-auth)
// held → released (QC passes, transfer to professional)
// held → partially_refunded (partial refund issued)
// held → refunded (full refund issued)

enum PayoutStatus {
  pending  // Awaiting QC pass
  paid     // Transferred
  blocked  // QC failed
}

enum QCStatus {
  passed   // Meets requirements
  revise   // Needs improvement (LLM never fails, only revise)
  missing  // No feedback submitted
}

enum DisputeReason {
  no_show           // Professional did not attend
  quality           // Call quality issues
  misrepresentation // Profile misrepresentation
  other             // Other reason (see description)
}

enum DisputeStatus {
  open              // Newly created, awaiting admin review
  under_review      // Admin is investigating
  resolved          // Resolution applied
}

enum AttendanceOutcome {
  both_joined          // Both parties attended
  candidate_no_show    // Candidate did not join
  professional_no_show // Professional did not join
  both_no_show         // Neither party joined
}
```

### State Invariants

Valid state combinations across the four status axes (BookingStatus × PaymentStatus × QCStatus × PayoutStatus):

| Invariant | Rule | Violation Indicates |
|-----------|------|---------------------|
| `PaymentStatus = refunded` | ⇒ `BookingStatus ∈ {cancelled, refunded, declined, expired}` | State corruption |
| `PaymentStatus = released` | ⇒ `QCStatus = passed OR candidateLateCancellation = true` | Premature payout |
| `PayoutStatus = blocked` | ⇒ `PaymentStatus ∈ {held, refunded}` | Inconsistent states |
| `PayoutStatus = paid` | ⇒ `PaymentStatus = released` | Orphan payout |
| `BookingStatus = accepted` | ⇒ `startAt` and `endAt` must be set | Missing schedule |
| `BookingStatus = completed` | ⇒ `qcStatus = passed` | Missing or incomplete feedback |
| `PaymentStatus = authorized` | ⇒ `BookingStatus ∈ {requested, declined, expired}` | Auth without capture |

**Note on `blocked` + `held`**: During `dispute_pending`, funds remain `held` in escrow while admin reviews. Only after resolution does PaymentStatus transition to `refunded` (if dispute upheld) or `released` (if dismissed).

**Enforcement**: State transition service validates invariants before committing any status change.

#### ProfessionalRating
```prisma
model ProfessionalRating {
  bookingId   String   @id
  rating      Int      // 1-5 stars
  text        String   // Min 50 characters
  submittedAt DateTime @default(now())
  timezone    String   @default("UTC")
  // Relation to booking

  @@map("ProfessionalReview") // Maps to existing table
}
```

**Usage**: Allows candidates to submit reviews/ratings for professionals after completed calls. This is distinct from `CallFeedback` which professionals submit about candidates.

#### Verification
```prisma
model Verification {
  id             String    @id @default(cuid())
  userId         String
  corporateEmail String
  token          String
  verifiedAt     DateTime?
  createdAt      DateTime  @default(now())
  timezone       String    @default("UTC")
}
```

**Usage**: Corporate email verification for professionals. Stores verification tokens and tracks verification status.

#### PasswordResetToken
```prisma
model PasswordResetToken {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  timezone  String   @default("UTC")
}
```

**Usage**: Password reset functionality. Tokens expire and are single-use.

### Model-to-Table Mappings

Name tables to match model names. Matching names is Prisma's default behavior and reduces confusion when switching between code and database.

### SQL Views

**ListingCardView**: Optimized view for professional listings
- Pre-joins User, ProfessionalProfile, and aggregates
- Used for search results and browse pages

### Indexes

- `User.role` - For role-based queries
- `Booking.candidateId`, `Booking.professionalId` - For user bookings
- `OAuthAccount.provider, providerAccountId` - For OAuth lookups

---

## API Routes

### Structure

All API routes are in `/src/app/api/` and follow Next.js App Router conventions. **APIs are organized by user role** for better clarity and maintainability.

> [!IMPORTANT]
> **Hard Cutover (No Legacy Paths)**
>
> As of version `0.3.0`, legacy paths were removed. There are no redirect/shim endpoints for:
> - `/professional/bookings/*`
> - `/api/professional/bookings/*`
> - `/candidate/book/[id]`
> - `/api/candidate/bookings/request`
>
> Use only canonical nested paths documented below.

### Authentication (`/api/auth/*`)

Shared authentication endpoints (kept at root for NextAuth compatibility):
- `POST /api/auth/signup` - User registration
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token
- `GET /api/auth/role` - Get current user's role
- `/api/auth/[...nextauth]` - NextAuth handlers

### Professional Portal (`/api/professional/*`)

Professional-specific endpoints:

**Requests (canonical nested paths)**:
- `GET /api/professional/requests/[id]/confirm-and-schedule` - View candidate's available times
- `POST /api/professional/requests/[id]/confirm-and-schedule` - Accept booking and schedule
  - **Step 1**: Captures payment via Stripe, updates status to `accepted_pending_integrations`
  - **Step 2**: Returns success to professional immediately
  - **Step 3**: BullMQ job handles Zoom meeting creation + calendar invites + email
  - **Step 4**: On job success: status → `accepted`
  - **Step 5**: On job failure: try again, and upon repeated failure, admin notified, manual Zoom link entry available
  - By selecting a time, the professional confirms/accepts the booking
- `POST /api/professional/requests/[id]/decline` - Decline booking request

**Rescheduling**:
- `POST /api/professional/requests/[id]/reschedule/request` - Request reschedule (triggers candidate availability sync)
  - Body: `{ reason?: string }`
  - Booking status → `reschedule_pending`
- `GET /api/professional/requests/[id]/reschedule` - View candidate's availability for reschedule
- `POST /api/professional/requests/[id]/reschedule/confirm` - Confirm new time (as initiator or responder)
  - Body: `{ startAt: DateTime }`
  - Cancels old Zoom, creates new one, sends updated invites
  - Booking status → `accepted`
- `POST /api/professional/requests/[id]/reschedule/reject` - Reject reschedule request
  - Booking status reverts to `accepted` with original time

> **Implementation Note**: Booking confirmation and rescheduling share helper functions for Zoom creation, calendar invites, and notifications. They use separate endpoints because: (1) first booking captures payment, rescheduling doesn't; (2) status transitions differ; (3) rescheduling deletes the old Zoom first.

**Feedback**:
- `POST /api/professional/feedback/[bookingId]` - Submit feedback after call
- `GET /api/professional/feedback/[bookingId]` - Retrieve historical feedback
- `POST /api/professional/feedback/validate` - Validate feedback (QC check)

**Settings & Account**:
- `POST /api/professional/onboarding` - Stripe Connect onboarding

### Candidate Portal (`/api/candidate/*`)

Candidate-specific endpoints:

**Bookings**:
- `POST /api/candidate/professionals/[id]/bookings` - Request a booking with payment authorization
  - Body: `{ availabilitySlots: [{start,end}], timezone? }`
  - `professionalId` is derived from route param `[id]`
  - Candidate submits explicit 30-minute availability slots from weekly picker UI
  - Submitted slots are synced into candidate `Availability` before booking request transition
  - Creates booking with status 'requested'
  - Creates Stripe PaymentIntent with `capture_method: 'manual'`
  - Returns `{ bookingId, clientSecret, stripePaymentIntentId }`
  - Payment is **authorized but not captured** until professional accepts

**Professional Discovery**:
- `GET /api/candidate/professionals/search` - Search/browse professionals (anonymized)
- `GET /api/candidate/professionals/[id]` - View professional profile details
  - Shows redacted profile if no booking history, reveals identity after first booking
- `GET /api/candidate/professionals/[id]/reviews` - View professional reviews

**Profile & Settings**:
- `GET /api/candidate/profile/[id]` - Get candidate profile
- `POST /api/candidate/availability` - Set availability preferences
- `GET /api/candidate/busy` - Get busy times from Google Calendar
  - Fetches 30 days of busy times, merges with manual availability

**Reviews**:
- `POST /api/candidate/reviews` - Submit review of professional after completed booking
  - Body: `{ bookingId, rating (1-5), text (min 50 chars), timezone }`
  - Only accessible after booking completed, prevents duplicate reviews

**Rescheduling**:
- `POST /api/candidate/bookings/[id]/reschedule/request` - Request reschedule
  - Body: `{ slots: TimeSlot[], reason?: string, timezone?: string }`
  - Only when status = `accepted`
  - Replaces candidate Availability with submitted slots for professional review
  - Booking status → `reschedule_pending`

**Disputes**:
- `POST /api/candidate/bookings/[id]/dispute` - Initiate dispute
  - Body: `{ reason: DisputeReason, description: string }`
  - Use cases: professional no-show, call quality issues, misrepresentation
  - Creates Dispute record, booking status → `dispute_pending`
  - Payout blocked until admin resolution

### Shared/Common Endpoints (`/api/shared/*`)

Endpoints used by both roles or system-level operations:

**Bookings**:
- `POST /api/shared/bookings/[id]/cancel` - Cancel booking (either party, respects 6hr window)

**Settings** (role-agnostic, uses session to determine profile type):
- `GET /api/shared/settings` - Get user settings (routes to CandidateProfile or ProfessionalProfile based on role)
- `PUT /api/shared/settings` - Update user settings
- `DELETE /api/shared/settings` - Delete user account

**Payments & Stripe**:
- `GET /api/shared/stripe/account` - Get Stripe account info
- `POST /api/shared/stripe/webhook` - Stripe webhook handler
  - Verifies Stripe signature, then calls `confirmPayment()` from `/lib/integrations/stripe/confirm.ts` directly
  - No internal HTTP calls — service function imported and invoked in-process

**Verification**:
- `POST /api/shared/verification/request` - Request email verification
- `POST /api/shared/verification/confirm` - Confirm email verification
- `GET /api/shared/verification/status` - Check verification status

**QC**:
- `POST /api/shared/qc/[bookingId]/recheck` - Recheck QC status (triggers new QC validation)
- `GET /api/shared/reviews` - Get reviews for a professional

### Admin Portal (`/api/admin/*`)

**Feedback Management**:
- `GET /api/admin/feedback/export` - Export all feedback records (CSV)
- Note: QC is fully automated via Claude API. No manual override endpoint.

**Dispute Management**:
- `GET /api/admin/disputes` - List all disputes (filterable by status)
- `GET /api/admin/disputes/[id]` - View dispute details with booking info
- `PUT /api/admin/disputes/[id]/resolve` - Resolve dispute
  - Body: `{ resolution: string, action: 'full_refund' | 'partial_refund' | 'dismiss', refundAmountCents?: number }`
  - Updates Dispute.status → `resolved`, applies refund/payout action

**Payments**:
- `POST /api/admin/payments/payout` - Release payment to professional
- `POST /api/admin/payments/refund` - Refund payment to candidate

**Bookings**:
- `PUT /api/admin/bookings/[id]/zoom-link` - Manually set Zoom link (fallback for failed provisioning)
  - Body: `{ zoomJoinUrl: string, zoomMeetingId?: string }`

**CSV Export Endpoints**:
- `GET /api/admin/users/export` - Export users
- `GET /api/admin/bookings/export` - Export bookings
- `GET /api/admin/payments/export` - Export payments
- `GET /api/admin/payouts/export` - Export payouts
- `GET /api/admin/feedback/export` - Export feedback
- `GET /api/admin/disputes/export` - Export disputes
- `GET /api/admin/audit-logs/export` - Export audit logs

### API Conventions

**Session Validation**: Every API route must call `auth()` to validate session

```typescript
import { auth } from '@/auth';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  // ... rest of handler
}
```

**Zod Validation**: Use Zod for request body validation

```typescript
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  price: z.number().positive(),
});

const parsed = schema.safeParse(body);
if (!parsed.success) {
  return Response.json({ error: 'validation_error' }, { status: 400 });
}
```

---

## Authentication & Authorization

### NextAuth Configuration

**File**: `/src/auth.ts`

**Providers**:
1. **Credentials** (Email + Password)
   - bcrypt hashing
   - Min 6 characters

2. **Google OAuth**
   - Scopes: `openid email profile calendar.readonly calendar.events`
   - Access type: `offline` (for refresh tokens)

3. **LinkedIn OAuth**
   - Scopes: `r_liteprofile r_emailaddress`

### Session Strategy

- **Type**: JWT (not database sessions)
- **Secret**: `AUTH_SECRET` or `NEXTAUTH_SECRET` env var
- **Session Object**:
  ```typescript
  {
    user: {
      id: string;
      role: 'CANDIDATE' | 'PROFESSIONAL' | 'ADMIN';
      email: string;
      name: string;
    }
  }
  ```

### Middleware Protection

**File**: `/src/middleware.ts`

```typescript
export { auth as middleware } from './auth';

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
```

**Protected Routes**: All routes except:
- API routes (must check `auth()` manually)
- Static files (`_next/static`, `_next/image`)
- Favicon
- Files with extensions

### RBAC (Role-Based Access Control)

**File**: `/lib/core/api-helpers.ts`

**Helper Functions**: `requireAuth()`, `requireRole()`, `withAuth()`, `withRole()`

```typescript
import { requireAuth, requireRole, withRole } from '@/lib/core/api-helpers';

// Option 1: Using requireRole directly
export async function GET() {
  const session = await requireRole(['ADMIN', 'PROFESSIONAL']);
  // ... rest of handler
}

// Option 2: Using withRole wrapper (recommended)
export const GET = withRole(['ADMIN', 'PROFESSIONAL'], async (session, req) => {
  // ... handler logic
  return NextResponse.json({ data: result });
});
```

**Admin Access**: Determined by `User.role = 'ADMIN'`. Initial admin user created via seed script.

### OAuth Account Management

**Model**: `OAuthAccount`
- Stores access tokens, refresh tokens
- Linked to User via `userId`
- Automatically updated on sign-in

---

## Important Workflows

### Booking Flow

```
1. DISCOVERY
   Candidate browses professionals
   → GET /api/candidate/professionals/search
   → Shows anonymized listings

2. REQUEST WITH AUTHORIZATION
   Candidate requests booking and authorizes payment
   → Candidate uses weekly 30-minute calendar (click/drag) and can override Google busy blocks
   → POST /api/candidate/professionals/[id]/bookings { availabilitySlots, timezone }
   → Submitted slots are written to Availability table
   → Creates booking with status: "requested"
   → Creates Stripe PaymentIntent with capture_method: 'manual'
   → Payment record created with status: "authorized"
   → Returns clientSecret and paymentIntentId
   → Candidate completes payment authorization via Stripe Elements (3DS if required)
   → Sends email notification to professional
   → **Important**: Funds are authorized (held on card) but NOT captured yet
   → Authorization typically expires after 7 days with most card issuers

3. PROFESSIONAL ACCEPTS (Funds Captured)
   Professional views candidate's available times and selects one
   → GET /api/professional/requests/[id]/confirm-and-schedule (view candidate availability)
   → POST /api/professional/requests/[id]/confirm-and-schedule { startAt }
   → Server calls stripe.paymentIntents.capture(paymentIntentId)
   → Payment record status changes: "authorized" → "held"
   → Funds now in platform escrow until QC passes
   → Creates Zoom meeting
   → Sends calendar invites to both parties
   → Booking status changes to "accepted"
   → If capture fails (expired authorization): Return error 400, booking remains "requested"

4. CALL
   Candidate and Professional join Zoom
   → Join tracking via database (candidateJoinedAt, professionalJoinedAt)
   → Status changes to "completed_pending_feedback" when call ends

5. FEEDBACK
   Professional submits feedback
   → POST /api/professional/feedback/[bookingId] { summary, actions, ratings }
   → Booking status changes to "completed"
   → Triggers QC job after transaction commits (not delayed)

6. QC & PAYOUT
   Background job validates feedback
   → If passed: Creates Payout record with status "pending", triggers transfer to professional
   → If revise: Nudge emails queued at +24h, +48h, +120h, professional can resubmit
   → If no revision after 7 days: 50% refund to candidate (net of Stripe fees), 50% to professional
   → See QC Validation Flow for details
```

### Payment Sequence Diagram

The following diagram shows the authorize-then-capture payment flow:

```mermaid
sequenceDiagram
    participant C as Candidate
    participant S as Next.js Server
    participant Stripe as Stripe API
    participant W as Webhook Handler

    C->>S: POST /bookings/request
    S->>Stripe: create PaymentIntent (manual capture)
    Stripe-->>S: PI requires_payment_method
    S-->>C: { clientSecret, bookingId }
    
    C->>Stripe: confirmCardPayment (3DS if needed)
    Stripe-->>C: PI requires_capture
    
    Note over C,W: Professional accepts (~7 day window)
    
    rect rgb(240, 248, 255)
        Note right of S: Professional accepts
        S->>Stripe: capture PaymentIntent
        Stripe-->>S: PI succeeded
        S-->>S: Payment.status = "held"
        Stripe->>W: payment_intent.succeeded
        W-->>W: Idempotent update (already held)
    end
```

### Authorization Expiration Handling

Stripe PaymentIntent authorizations expire after ~7 days (card issuer dependent).

**Scenario: Professional accepts after authorization expired**
- Server attempts `stripe.paymentIntents.capture()` → Stripe returns error
- Return 400 to professional: "Payment authorization expired"
- Booking remains in "requested" status
- Notify candidate to re-authorize payment

**Scenario: Booking scheduled >7 days after request**
- Capture immediately at acceptance, hold in platform escrow

**Scenario: Authorization expires before 120-hour request expiry**
- Expiry job should check Payment status before processing
- If authorization expired, update Payment status accordingly
- Candidate receives notification to re-authorize or let request expire

### Cancellation Flow

```
PROFESSIONAL CANCELLATION (anytime)
  → POST /api/shared/bookings/[id]/cancel
  → Full refund processed immediately
  → Status: "cancelled"
  → PaymentStatus: "refunded"

CANDIDATE CANCELLATION (>= 6 hours before call)
  → POST /api/shared/bookings/[id]/cancel
  → Full refund processed immediately
  → Status: "cancelled"
  → PaymentStatus: "refunded"

CANDIDATE LATE CANCELLATION (< 6 hours before call)
  → POST /api/shared/bookings/[id]/cancel
  → Returns error 400: "Cannot cancel within 6 hours of scheduled call time"
  → No refund, booking remains active

  **If candidate forces late cancellation** (e.g. no-show):
  → No refund issued (per policy)
  → Professional was available and committed their time
  → Payout triggered immediately, bypassing QC (no call = no feedback required)
  → Platform fee still deducted from payout
  → Rationale: Professional blocked their calendar; cancellation is candidate's forfeiture
```

### No-Show Detection Flow

```
1. Background job runs 15 minutes after scheduled start time
   → Query: status = 'accepted' AND startAt < (now - 15 minutes)

2. For each booking, check join timestamps:
   → If both null: attendanceOutcome = 'both_no_show'
   → If candidateJoinedAt null: attendanceOutcome = 'candidate_no_show'  
   → If professionalJoinedAt null: attendanceOutcome = 'professional_no_show'
   → If both present: attendanceOutcome = 'both_joined'

3. Handle professional no-show:
   → Auto-create Dispute with reason = 'no_show'
   → BookingStatus transitions to 'dispute_pending'
   → Notify candidate and admin
   → No payout until admin resolution

4. Handle candidate no-show:
   → Treat as late cancellation (professional gets paid)
   → Bypass QC, trigger payout immediately
   → Notify professional

5. Handle both no-show:
   → Create admin task for manual review
   → Funds remain held until resolution
```

### Professional Decline Flow

```
1. Professional calls POST /api/professional/requests/[id]/decline
   Body: { reason?: string }  // Optional decline reason

2. Validate booking is in 'requested' status
   → If not requested: Return 400 "Booking cannot be declined in current state"

3. Update booking state
   → status: 'declined'
   → declineReason: provided reason or null

4. Release payment authorization or process refund
   → If PaymentStatus = 'authorized': Cancel the PaymentIntent authorization
   → If PaymentStatus = 'held': Process full refund
   → Update Payment record: status = 'refunded'

5. Send notification to candidate
   → Email with decline information
   → Include declineReason if provided

6. Log audit event
   → { action: 'booking_declined', bookingId, professionalId, reason, timestamp }
```

### Request Expiration Flow

```
1. Booking Creation
   → Set expiresAt = createdAt + 120 hours for 'requested' bookings
   → Configurable via BOOKING_REQUEST_EXPIRY_HOURS env var (default: 120)

2. Background Job: booking-expiry-check
   → Runs hourly via BullMQ scheduled job
   → Query: status = 'requested' AND expiresAt < now()

3. For each expired booking:
   a. Update status to 'expired'
   b. Release authorization / process refund
      → Cancel PaymentIntent authorization or refund captured funds
      → Update Payment record: status = 'refunded'
   c. Notify candidate
      → Email: "Your booking request has expired"
   d. Notify professional
      → Email: "A booking request has expired"
   e. Log audit event
      → { action: 'booking_expired', bookingId, timestamp }
```

### Error Handling and Edge Cases

**Capture Fails After Professional Accepts**
- Server attempts `stripe.paymentIntents.capture(paymentIntentId)`
- Stripe returns error (e.g., `payment_intent_unexpected_state`, `card_declined`)
- API returns 400 error to professional with message
- PaymentStatus transitions to `capture_failed`
- Notify candidate: "Please update your payment method"
- Professional's time slot released (they can accept other bookings)
- Candidate can:
  → Update payment method and re-authorize (PaymentStatus returns to `authorized`)
  → Let booking expire after timeout (configurable, default 24h)
- If timeout reached: Booking transitions to `expired`

**Zoom Meeting Creation Fails**
- Payment already captured (funds held in escrow)
- Booking status remains `accepted_pending_integrations`
- BullMQ job retries Zoom creation (3 attempts, exponential backoff: 1min, 5min, 15min)
- If all retries fail:
  - Admin notification created with booking details
  - Admin can manually enter Zoom link via `PUT /api/admin/bookings/[id]/zoom-link`
  - Professional and candidate notified of delay
  - Once link entered: status → `accepted`, calendar invites sent

**Google Calendar Invite Fails**
- Non-blocking: booking proceeds
- Logged as warning
- User sees "Calendar sync failed" in booking details
- Manual calendar entry guidance provided

**Race Condition: Accept vs 120-Hour Expiry**
- Use optimistic locking on Booking.status
- Accept transaction: `WHERE status = 'requested'`
- Expiry job: `WHERE status = 'requested' AND expiresAt < now()`
- First to commit wins; other fails gracefully

### QC Validation Flow

```
1. Feedback submitted
   → Validates min 200 words
   → Validates exactly 3 actions
   → Validates 3 star ratings present

2. QC Job triggered after transaction commits
   → BullMQ "qc" queue
   → Job ID: `qc:${bookingId}:${feedbackVersion}` (idempotent)

3. LLM Validation (Claude API)
   → Calls Claude API with feedback text and validation prompt
   → Prompt template: [TO BE FILLED IN]
   → LLM returns: `passed` | `revise` (never fails)

4. If PASSED
   → Payout.status = "pending"
   → BullMQ payout job triggered immediately
   → Stripe transfer to professional's connected account

5. If REVISE
   → Nudge emails enqueued at +24h, +48h, +96h
   → Professional can resubmit feedback
   → Each resubmission triggers new QC check
   → If no revision after +168h (7 days):
     → Auto-issue 50% refund to candidate (net of Stripe fees)
     → Remaining 50% released to professional (net of Stripe fees)
     → Booking marked as `completed` with partial refund flag
     → Logs audit event
```

### Google Calendar Sync

```
1. OAuth Connection
   → User signs in with Google
   → Scopes: calendar.readonly + calendar.events
   → OAuthAccount created with tokens

2. Fetch Availability
   → GET /api/candidate/busy
   → Calls Google Calendar API freebusy
   → Returns next 30 days of busy times

3. Candidate Slot Selection
   → Busy blocks are shown in candidate weekly slot picker
   → Candidate can manually refresh busy data via "Refresh Google Calendar"
   → Busy blocks are advisory and can be explicitly overridden per slot
   → Candidate submits selected slots as availability payload

4. Display to Professional
   → GET /api/professional/requests/[id]/confirm-and-schedule
   → Shows candidate-submitted slots in 30-min blocks
   → Professional selects exactly one slot
```

### Timezone Handling

```
1. Client Detection
   → Client detects timezone via: Intl.DateTimeFormat().resolvedOptions().timeZone
   → Sends timezone with each request that involves dates

2. Storage (Always UTC)
   → All DateTime fields stored in UTC in database
   → timezone field stores user's IANA timezone string at creation time

3. User Timezone Tracking
   → User.timezone: User's current/preferred timezone
   → Booking.timezone: Timezone context for the booking
   → Candidate and Professional may be in different timezones

4. Display Conversion
   → Display-time conversion uses user's CURRENT timezone (may differ if traveled)
   → Use date-fns-tz: formatInTimeZone(date, userTimezone, format)

5. Edge Cases
   → Booking creation: Store both candidate and professional timezones
   → Availability: Convert to professional's timezone for display to candidate
   → Notifications: Format times in recipient's timezone
```

### Rescheduling Flow

> **Pattern**: Mirror the existing booking flow — proposer offers time slots, responder picks one  
> **Status**: Uses existing `reschedule_pending` booking state

```
CANDIDATE INITIATES RESCHEDULE
1. Candidate requests reschedule
   → POST /api/candidate/bookings/[id]/reschedule/request
   → Body: { slots: TimeSlot[], reason?: string, timezone?: string }
   → Candidate can use same weekly 30-minute picker + Google refresh flow as initial request
   → Submitted slots replace candidate Availability records
   → Only available when status = 'accepted'
   → Booking.status transitions to 'reschedule_pending'
   → Notification sent to professional

2. Professional reviews and selects new time
   → Professional sees action item in `/professional/requests` (requested + reschedule_pending)
   → GET /api/professional/requests/[id]/reschedule (view proposed slots)
   → POST /api/professional/requests/[id]/reschedule/confirm { startAt }
   → Updates booking startAt/endAt
   → Cancels previous Zoom meeting, creates new one
   → Sends new calendar invites to both parties
   → Booking.status transitions back to 'accepted'

3. If REJECTED
   → POST /api/professional/requests/[id]/reschedule/reject
   → Booking.status transitions back to 'accepted'
   → Original scheduled time is kept
   → Notify candidate of rejection

---

PROFESSIONAL INITIATES RESCHEDULE
1. Professional requests reschedule
   → POST /api/professional/requests/[id]/reschedule/request
   → Body: { reason?: string }
   → Triggers resync of candidate's Google Calendar availability
   → Booking.status transitions to 'reschedule_pending'
   → Notification sent to candidate

2. Professional views candidate's availability and picks new time
   → Similar to initial booking accept flow:
   → GET /api/professional/requests/[id]/reschedule (view candidate's Availability)
   → POST /api/professional/requests/[id]/reschedule/confirm { startAt }
   → Cancels previous Zoom meeting, creates new one
   → Sends new calendar invites
   → Booking.status transitions back to 'accepted'

---

EDGE CASES
- If rescheduled time is outside authorization window: Re-charge may be needed
- If other party doesn't respond: Revert to 'accepted' after timeout (configurable)
- Reschedule count: Track via AuditLog queries if needed (no dedicated field)
```

**Note**: Avoids cancel-and-rebook path which wastes Stripe fees. Zoom meetings are cancelled and recreated rather than updated.

### Dispute Resolution

> **Trigger**: Candidate-initiated or QC failure escalation

```
1. Dispute initiated
   → POST /api/candidate/bookings/[id]/dispute
   → Body: { reason, details }
   → Use cases: professional no-show, call quality issues, misrepresentation
   → OR: Triggered automatically when admin marks QC as 'failed'

2. Immediate effects
   → BookingStatus transitions to 'dispute_pending'
   → PayoutStatus transitions to 'blocked'
   → Admin notification/task created
   → Candidate confirmation sent

3. Admin investigation
   → Admin reviews booking details, call logs, feedback
   → May contact both parties
   → Access via admin dashboard

4. Resolution options
   → Full refund: PaymentStatus = 'refunded', Payout.status = 'blocked'
   → Partial refund: Custom refund amount, Payout.status = 'blocked'
   → Dismiss (release payout): PayoutStatus = 'pending' → 'paid'

Note: Provides recourse when professional is no-show or quality is poor.
Does NOT auto-refund on QC failure to prevent "theft of service".
```

---

## Testing

### Testing Philosophy

> **For small/lean teams**: Focus on high-value tests that catch real bugs. Don't over-test rapidly changing features.

```mermaid
graph TB
    subgraph "Testing Pyramid"
        E2E["🌐 E2E Tests<br/>Few, slow, high confidence<br/>Critical user journeys only"]
        INT["⚡ Integration Tests<br/>API routes + database<br/>Core business logic"]
        UNIT["🔧 Unit Tests<br/>Many, fast<br/>Pure functions & utilities"]
    end
    
    E2E --> INT --> UNIT
    
    style E2E fill:#ff6b6b,color:white
    style INT fill:#feca57,color:black
    style UNIT fill:#5f27cd,color:white
```

### Pragmatic Test Strategy

| What to Test | When to Test | Skip If... |
|--------------|--------------|------------|
| Payment flows | **Always** | Never skip |
| State transitions | **Always** | Never skip |
| QC validation | **Always** | Never skip |
| API routes | When stable | Feature in flux |
| UI components | Critical only | Rapidly iterating |

### Test Stack (Simple)

- **Vitest** - Unit + integration tests
- **Playwright** - E2E tests (add later when flows stabilize)

### Running Tests

```bash
npm run test        # All tests
npm run test:watch  # Watch mode (recommended during dev)
npm run test:e2e    # E2E tests
```

### Test File Organization

```
tests/
├── payments.test.ts       # Payment capture, refund, payout
├── bookings.test.ts       # State transitions, cancellations
├── qc.test.ts             # QC validation, payout gating
├── availability.test.ts   # Slot logic, timezone handling
├── mocks/
│   └── stripe.ts          # Stripe API mock
└── e2e/
    └── booking-flow.test.ts  # Full happy path (add when stable)
```

### What MUST Be Tested (Non-Negotiable)

> [!CAUTION]
> These handle money and state - bugs here are costly.

1. **Payment capture/refund** - Every code path
2. **Booking state transitions** - All valid transitions
3. **QC validation** - Payout gating logic
4. **Cancellation policy** - 6-hour window enforcement

### Simple Mocking Pattern

```typescript
// tests/mocks/stripe.ts
import { vi } from 'vitest';

export const mockStripe = {
  paymentIntents: {
    create: vi.fn().mockResolvedValue({ id: 'pi_test', client_secret: 'secret' }),
    capture: vi.fn().mockResolvedValue({ id: 'pi_test', status: 'succeeded' }),
  },
  refunds: {
    create: vi.fn().mockResolvedValue({ id: 'ref_test' }),
  },
};

// Usage: vi.mock('@/lib/integrations/stripe', () => ({ stripe: mockStripe }));
```

### When to Add More Tests

- ✅ Feature is stable and unlikely to change
- ✅ Bug was found in production → add regression test
- ✅ Complex logic that's hard to manually verify
- ❌ UI that's still being designed
- ❌ Features behind feature flags that may be removed

## Code Patterns

### Singleton Pattern (Prisma Client)

**File**: `/lib/core/db.ts`

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production')
  globalForPrisma.prisma = prisma;
```

**Why**: Prevents multiple Prisma instances during hot reload in development

### Component Composition Pattern

Build explicit presentational components with typed props; keep data-fetching in route/page layers.

```typescript
// src/components/bookings/BookingCard.tsx
interface BookingCardProps {
  title: string;
  priceLabel: string;
  onCancelClick?: () => void;
}

export function BookingCard({ title, priceLabel, onCancelClick }: BookingCardProps) {
  return (
    <article className="surface p-4">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-gray-600">{priceLabel}</p>
      {onCancelClick ? <button onClick={onCancelClick}>Cancel</button> : null}
    </article>
  );
}
```

**Why**: Components stay portable and easy to restyle while routes retain ownership of domain data and side effects.

### Service Layer Pattern

Business logic is isolated in `/lib/*` utilities, not in API routes.

**Example**: Payment processing logic in `/lib/integrations/stripe/index.ts`

```typescript
// ❌ BAD: Logic in API route
export async function POST(req: Request) {
  const { amount } = await req.json();
  const fee = amount * 0.2;
  const intent = await stripe.paymentIntents.create({...});
  // ...
}

// ✅ GOOD: Logic in service layer
// /lib/integrations/stripe/index.ts
export async function createPaymentIntent(bookingId: string) {
  const booking = await prisma.booking.findUnique({...});
  const fee = booking.price * 0.2;
  const intent = await stripe.paymentIntents.create({...});
  return intent;
}

// /api/bookings/[id]/checkout/route.ts
export async function POST(req: Request, { params }) {
  const intent = await createPaymentIntent(params.id);
  return Response.json({ clientSecret: intent.client_secret });
}
```

### Factory Pattern (Stripe Resources)

Helper functions create consistent Stripe resources:

```typescript
export function createDestinationCharge(
  amountCents: number,
  professionalStripeId: string,
  platformFeeCents: number
) {
  return {
    amount: amountCents, // Already in cents (e.g., 10000 = $100.00)
    currency: 'usd',
    transfer_data: {
      destination: professionalStripeId,
      amount: amountCents - platformFeeCents,
    },
  };
}
```

**Note on Stripe Connect Patterns**:

This system uses **Separate Charges and Transfers** (not destination charges) to enable escrow/gating:

1. **Charge Platform**: Payment is captured to the platform's Stripe account
2. **Hold Funds**: Funds remain on platform during QC validation period
3. **Transfer After QC**: Only after QC passes, funds are transferred to professional's connected account

This pattern is required because destination charges transfer funds immediately to the connected account's pending balance, which conflicts with the QC gating business rule.

```typescript
// Step 1: Capture to platform (at booking confirmation)
const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);

// Step 2: Transfer to professional (after QC passes)
const transfer = await stripe.transfers.create({
  amount: amountCents - platformFeeCents,
  currency: 'usd',
  destination: professionalStripeAccountId,
  transfer_group: `booking_${bookingId}`,
});
```

### Observer Pattern (Webhooks)

**Stripe Webhook**: `/api/stripe/webhook/route.ts`

Listens for events:
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `transfer.created`
- `account.updated`

### Webhook Security Pattern

**Critical**: All webhook handlers MUST verify Stripe signatures before processing.

**File**: `/api/shared/stripe/webhook/route.ts`

```typescript
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return Response.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Process verified event...
  await processWebhookEvent(event);

  // Must return 200 within 5-10 seconds
  return Response.json({ received: true });
}
```

**Webhook Security Requirements**:
1. **Signature verification is REQUIRED** using `STRIPE_WEBHOOK_SECRET` before processing any event
2. **Unsigned requests must be rejected** with 400 status
3. **Handlers must be idempotent** - Stripe retries failed webhooks up to 3 days
4. **Return 200 within 5-10 seconds** - offload long operations to BullMQ
5. **Handled events**: `payment_intent.succeeded`, `payment_intent.payment_failed`, `transfer.created`, `account.updated`

### Payment Confirmation Idempotency Pattern

**Problem**: Both `POST /api/shared/payments/confirm` (client-side) and the Stripe webhook handler can fire for the same payment within milliseconds, causing duplicate processing.

**Solution**: Use PaymentIntent ID as natural idempotency key.

```typescript
async function confirmPayment(stripePaymentIntentId: string): Promise<Payment> {
  // Check current state before processing
  const existing = await prisma.payment.findFirst({
    where: { stripePaymentIntentId },
  });

  // Already processed - return success without reprocessing
  if (existing && existing.status !== 'authorized') {
    return existing;
  }

  // Process the confirmation with optimistic locking
  return await prisma.payment.update({
    where: {
      paymentIntentId,
      status: 'authorized', // Only update if still in authorized state
    },
    data: {
      status: 'held',
      confirmedAt: new Date(),
    },
  });
}
```

**Idempotency Requirements**:
1. Use PaymentIntent ID as natural idempotency key
2. Check current `Payment.status` before processing—if already beyond `authorized`, return success without reprocessing
3. Store `paymentConfirmedAt` timestamp to detect duplicate processing
4. Use optimistic locking with status checks in WHERE clause

### Timezone Handling Pattern

**Every temporal field includes timezone**:

```typescript
type TimeSlot = {
  start: Date;
  end: Date;
  timezone: string; // IANA timezone
};
```

**Conversion utilities** in `/lib/utils/timezones.ts`:

```typescript
import { formatInTimeZone } from 'date-fns-tz';

export function convertToUserTimezone(date: Date, timezone: string) {
  return formatInTimeZone(date, timezone, 'yyyy-MM-dd HH:mm:ssXXX');
}
```

### Feature Flag Pattern

**File**: `/lib/core/flags.ts`

```typescript
export const flags = {
  FEATURE_LINKEDIN_ENHANCED: process.env.FEATURE_LINKEDIN_ENHANCED === 'true',
  FEATURE_QC_LLM: process.env.FEATURE_QC_LLM !== 'false',
};
```

**Usage in code**:

```typescript
import { flags } from '@/lib/core/flags';

if (flags.FEATURE_LINKEDIN_ENHANCED) {
  // Enhanced LinkedIn features
}
```

### Rate Limiting Pattern

**In-memory rate limiter** for development:

```typescript
const rateLimit = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(identifier: string, limit: number = 10) {
  const now = Date.now();
  const record = rateLimit.get(identifier);

  if (!record || record.resetAt < now) {
    rateLimit.set(identifier, { count: 1, resetAt: now + 60000 });
    return true;
  }

  if (record.count >= limit) {
    return false;
  }

  record.count++;
  return true;
}
```

### State Machine Pattern for Bookings

**File**: `/lib/domain/bookings/transitions.ts`

All booking state transitions must flow through a centralized `BookingService` module to ensure consistency, proper side effects, and audit logging.

**Exported Functions**:

```typescript
// All state transitions go through these functions
export async function createBookingRequest(params: CreateBookingParams): Promise<Booking>;
export async function acceptBooking(bookingId: string, startAt: Date): Promise<Booking>;
export async function declineBooking(bookingId: string, reason?: string): Promise<Booking>;
export async function cancelBooking(bookingId: string, cancelledBy: string): Promise<Booking>;
export async function expireBooking(bookingId: string): Promise<Booking>;
export async function completeBooking(bookingId: string): Promise<Booking>;
```

**Each function**:
1. Validates current state allows the transition
2. Updates booking status within a transaction
3. Coordinates side effects (payments, notifications, calendar)
4. Creates audit log entry
5. Validates state invariants before committing

**State Transition Diagram**:

```
                    ┌─────────────┐
                    │    draft    │
                    └─────┬───────┘
                          │ submit
                          ▼
                    ┌─────────────┐
            ┌───────│  requested  │───────┐
            │       └─────┬───────┘       │
     decline│             │ accept   expire│
            ▼             ▼               ▼
     ┌──────────┐   ┌─────────────┐  ┌─────────┐
     │ declined │   │  accepted   │  │ expired │
     └──────────┘   └─────┬───────┘  └─────────┘
                          │
              cancel ┌────┴────┐ complete
                     ▼         ▼
              ┌───────────┐  ┌──────────────────────────┐
              │ cancelled │  │ completed_pending_feedback│
              └───────────┘  └─────────────┬────────────┘
                                           │ feedback submitted and QC passed
                                           ▼
                                     ┌───────────┐
                                     │ completed │
                                     └───────────┘
```

### Idempotent Background Jobs

**Problem**: BullMQ retries failed jobs, which can cause duplicate processing (emails, payouts, state changes).

**Solution Pattern**:

1. **Deterministic Job IDs**: Use predictable IDs to prevent duplicate jobs

```typescript
// QC jobs: one per feedback version
await qcQueue.add('validate', { bookingId, feedbackVersion }, {
  jobId: `qc:${bookingId}:${feedbackVersion}`,
});

// Nudge jobs: one per booking per interval
await nudgeQueue.add('send', { bookingId, interval: '24h' }, {
  jobId: `nudge:${bookingId}:24h`,
});
```

2. **Database Uniqueness Constraints**:
   - `Payout.bookingId` UNIQUE - prevents duplicate payouts
   - `Payment.bookingId` UNIQUE - prevents duplicate payment records

3. **Side-Effect Timestamps**: Store when side effects occurred

```typescript
model Booking {
  payoutReleasedAt   DateTime?
  refundCreatedAt    DateTime?
  lastNudgeSentAt    DateTime?
}
```

4. **Handler Idempotency Check**:

```typescript
async function processPayoutJob(job: Job<PayoutData>) {
  const booking = await prisma.booking.findUnique({
    where: { id: job.data.bookingId },
  });
  
  // Already processed - exit early
  if (booking.payoutReleasedAt) {
    return { status: 'already_processed' };
  }
  
  // Process payout...
}
```

### Worker Process Constraints

**Hard Rule**: The BullMQ worker process is a standalone Node.js process, NOT a Next.js server context.

**Worker May Import**:
- ✅ Prisma client (`@/lib/core/db`)
- ✅ Third-party integrations (`@/lib/integrations/*`)
- ✅ Domain services (`@/lib/domain/*`)
- ✅ Pure utilities (`@/lib/utils/*`)

**Worker Must NEVER Import**:
- ❌ Next.js route handlers
- ❌ `next/server` module
- ❌ `cookies()`, `headers()` from Next.js
- ❌ React components
- ❌ `auth()` function (calls NextAuth runtime)

**Pattern for Auth Context**: Pass actor context as parameter instead of calling `auth()` implicitly:

```typescript
// ❌ BAD: Implicit auth call (crashes in worker)
async function releasePayour(bookingId: string) {
  const session = await auth(); // CRASH!
  // ...
}

// ✅ GOOD: Explicit actor parameter
async function releasePayout(
  bookingId: string, 
  actor: { id: string; role: string } | 'system'
) {
  // Works in both API routes and worker
}
```

### Dependency Injection for Testability

**Pattern**: Service layer functions accept optional `deps` parameter with production defaults.

```typescript
// Service function with injectable dependencies
export async function processRefund(
  bookingId: string,
  deps = {
    prisma: defaultPrisma,
    stripe: defaultStripe,
    email: defaultEmailService,
  }
) {
  const booking = await deps.prisma.booking.findUnique({
    where: { id: bookingId },
  });
  
  await deps.stripe.refunds.create({
    payment_intent: booking.paymentIntentId,
  });
  
  await deps.email.sendRefundNotification(booking);
}

// In tests
it('should process refund', async () => {
  const mockPrisma = { booking: { findUnique: vi.fn().mockResolvedValue(mockBooking) } };
  const mockStripe = { refunds: { create: vi.fn().mockResolvedValue({ id: 'ref_123' }) } };
  const mockEmail = { sendRefundNotification: vi.fn() };
  
  await processRefund('booking_123', {
    prisma: mockPrisma,
    stripe: mockStripe,
    email: mockEmail,
  });
  
  expect(mockStripe.refunds.create).toHaveBeenCalled();
});
```

---

## Common Tasks

### Adding a New API Endpoint

1. Create route file: `/src/app/api/your-endpoint/route.ts`
2. Add session validation:
   ```typescript
   import { auth } from '@/auth';

   export async function GET(request: Request) {
     const session = await auth();
     if (!session?.user) {
       return Response.json({ error: 'unauthorized' }, { status: 401 });
     }
     // ...
   }
   ```
3. Add Zod validation if needed
4. Implement business logic in `/lib/*` service layer
5. Return consistent JSON responses
6. Update this CLAUDE.md with new endpoint

### Adding a New Database Model

1. Edit `/prisma/schema.prisma`
2. Add model with required fields:
   ```prisma
   model YourModel {
     id        String   @id @default(cuid())
     createdAt DateTime @default(now())
     updatedAt DateTime @updatedAt
     timezone  String   @default("UTC")
     // ... other fields
   }
   ```
3. Create migration:
   ```bash
   npx prisma migrate dev --name add_your_model
   ```
4. Update seed data in `/prisma/seed.ts` if needed
5. Regenerate Prisma client:
   ```bash
   npx prisma generate
   ```

### Adding a New Page

1. **Create Next.js route**: `/src/app/your-route/page.tsx` (Server Component by default)
2. **Compose shared UI**: Reuse components from `/src/components/*` first
3. **Add new components modularly**: create `ComponentName.tsx` (+ `ComponentName.module.css` when needed) in the right domain folder
4. **Use client only when necessary**: split interactive logic into a colocated `*Client.tsx`
5. **Connect data**: Fetch in Server Component, pass serializable props to client/shared components

Example structure:
```
/src/app/booking/[id]/
├── page.tsx              # Server: fetches data, renders BookingPageClient
├── BookingPageClient.tsx # Client: interaction layer only (if needed)
└── BookingDetails.module.css
```

### Adding a Background Job

1. Define job in `/lib/queues/index.ts`:
   ```typescript
   export async function addYourJob(data: YourJobData) {
     await yourQueue.add('job-name', data, {
       delay: 1000, // Optional delay in ms
     });
   }
   ```
2. Add worker processor:
   ```typescript
   yourQueue.process('job-name', async (job) => {
     const { data } = job;
     // Process job
   });
   ```
3. Trigger job from API route or other code:
   ```typescript
   import { addYourJob } from '@/lib/queues';
   await addYourJob({ ... });
   ```

### Adding a Feature Flag

1. Add environment variable to `.env`:
   ```
   FEATURE_YOUR_FLAG=true
   ```
2. Add to `/lib/core/flags.ts`:
   ```typescript
   export const flags = {
     // ... existing flags
     FEATURE_YOUR_FLAG: process.env.FEATURE_YOUR_FLAG === 'true',
   };
   ```
3. Use in code:
   ```typescript
   import { flags } from '@/lib/core/flags';

   if (flags.FEATURE_YOUR_FLAG) {
     // New feature code
   }
   ```

### Debugging Common Issues

#### Database Connection Issues

```bash
# Check DATABASE_URL in .env
echo $DATABASE_URL

# Test connection
npx prisma db pull

# Reset database (WARNING: Deletes all data)
npx prisma migrate reset
```

#### Redis Connection Issues

```bash
# Check Redis is running
redis-cli ping
# Expected: PONG

# Check REDIS_URL
echo $REDIS_URL

# View Redis logs
docker compose logs redis
```

#### NextAuth Issues

```bash
# Check AUTH_SECRET is set
echo $AUTH_SECRET

# Clear Next.js cache
npm run clean

# Check session in browser console
console.log(await fetch('/api/auth/session').then(r => r.json()))
```

#### Prisma Type Generation

```bash
# Regenerate Prisma client
npx prisma generate

# If types are stale, restart TypeScript server in VSCode
# CMD/CTRL + Shift + P → "TypeScript: Restart TS Server"
```

---

## Environment Variables

### Required Variables

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/monet"

# Redis (for BullMQ)
REDIS_URL="redis://localhost:6379"

# NextAuth
AUTH_SECRET="your-secret-key-here"
# or
NEXTAUTH_SECRET="your-secret-key-here"

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."

# Platform Fee (decimal: 0.20 for 20%, default: 0.20)
PLATFORM_FEE=0.20
```

### OAuth Providers

```bash
# Google OAuth (with Calendar scopes)
GOOGLE_CLIENT_ID="your-client-id"
GOOGLE_CLIENT_SECRET="your-client-secret"

# LinkedIn OAuth
LINKEDIN_CLIENT_ID="your-client-id"
LINKEDIN_CLIENT_SECRET="your-client-secret"
```

### Zoom Integration

```bash
ZOOM_ACCOUNT_ID="your-account-id"
ZOOM_CLIENT_ID="your-client-id"
ZOOM_CLIENT_SECRET="your-client-secret"
```

### AWS + Supabase Storage

```bash
# SES for Email
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"

# Supabase Storage for Resume PDFs
SUPABASE_URL="https://your-project-ref.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
SUPABASE_RESUME_BUCKET="candidate-resumes"
```

### Feature Flags

```bash
# LinkedIn Enhanced Features (default: false)
FEATURE_LINKEDIN_ENHANCED=false

# LLM-based QC (default: true)
FEATURE_QC_LLM=true
```

### Configuration

```bash
# Call Duration in Minutes (default: 30)
CALL_DURATION_MINUTES=30

# Default Timezone (default: America/New_York)
DEFAULT_TIMEZONE=America/New_York
```

---

## Troubleshooting

### Common Errors

#### "PrismaClientInitializationError: Can't reach database server"

**Cause**: Database not running or DATABASE_URL incorrect

**Solution**:
```bash
# Start Docker Postgres
docker compose up -d postgres

# Or check your DATABASE_URL
echo $DATABASE_URL
```

#### "ECONNREFUSED 127.0.0.1:6379"

**Cause**: Redis not running

**Solution**:
```bash
# Start Docker Redis
docker compose up -d redis

# Or check your REDIS_URL
echo $REDIS_URL
```

#### "Invalid `prisma.model.findUnique()` invocation"

**Cause**: Prisma client out of sync with schema

**Solution**:
```bash
npx prisma generate
```

#### "Error: No session found"

**Cause**: User not authenticated or AUTH_SECRET mismatch

**Solution**:
1. Check AUTH_SECRET is consistent
2. Clear browser cookies
3. Sign in again

#### "Stripe: No such payment_intent"

**Cause**: Payment intent not created, expired authorization, or invalid ID

**Solution**:
1. Check Stripe dashboard for payment intent
2. Ensure `/api/candidate/professionals/[id]/bookings` was called first
3. **Note on expiration**: Stripe PaymentIntent authorizations typically expire after 7 days with most card issuers. If booking is scheduled beyond this window, the system must either capture immediately and hold funds in platform balance, or save the payment method for later charging.
4. **Important**: Stripe Checkout Sessions (not used by this system) expire after 24 hours—do not confuse with PaymentIntent authorizations.

### Performance Issues

#### Slow Database Queries

1. Check for missing indexes in schema
2. Use Prisma's query logging:
   ```typescript
   const prisma = new PrismaClient({
     log: ['query', 'info', 'warn', 'error'],
   });
   ```
3. Consider using `ListingCardView` for complex joins

#### High Memory Usage

1. Check for memory leaks in background jobs
2. Limit batch sizes in queue processors
3. Use pagination for large data sets

### Debugging Tools

```bash
# Prisma Studio (Database GUI)
npx prisma studio

# View Redis Queue Jobs
# Install BullMQ CLI
npm install -g bullmq-cli
bullmq-cli list qc

# View Logs
docker compose logs -f app
docker compose logs -f worker

# Check Next.js Build
npm run build
# Look for errors or warnings
```

### Frontend Component Issues

#### "Hooks/Event handlers in a Server Component error"

**Cause**: Interactive logic in a Server Component

**Solution**: Move interactivity into a colocated Client Component (`'use client'`) and pass data via props

#### "CSS conflicts or unexpected base styles"

**Cause**: Global utility classes overriding component styles (or vice versa)

**Solution**:
1. Keep tokens/resets/utilities in `src/app/globals.css`
2. Move component-specific styling into local CSS Modules to isolate style scope

#### "Hydration mismatch warnings"

**Cause**: Client-only values rendered on the server (time, random, browser APIs)

**Solution**: Compute browser-only state in `useEffect` or gate rendering until mounted

---

## Important Files Reference

### Authentication
- `/src/auth.ts` - NextAuth configuration
- `/src/middleware.ts` - Auth middleware
- `/lib/core/api-helpers.ts` - API authentication and authorization helpers

### Database
- `/lib/core/db.ts` - Prisma client singleton
- `/prisma/schema.prisma` - Database schema
- `/prisma/seed.ts` - Seed data

### Payments
- `/lib/integrations/stripe/index.ts` - Stripe utilities
- `/api/stripe/webhook/route.ts` - Stripe webhook handler

### Background Jobs
- `/lib/queues/index.ts` - BullMQ queues and workers
- `/scripts/dev-queue.ts` - Queue worker entry point

### Calendar Integration
- `/lib/integrations/calendar/google.ts` - Google Calendar API
- `/lib/utils/timezones.ts` - Timezone utilities

### Configuration
- `/lib/core/flags.ts` - Feature flags
- `/.env` - Environment variables (gitignored)
- `/.env.example` - Environment template

### Testing
- `/tests/*.test.ts` - Unit tests
- `/tests/e2e/*.test.ts` - E2E tests

### Frontend Component System
- `/src/components/ui/README.md` - UI architecture and layering conventions
- `/src/components/ui/primitives/` - Reusable low-level custom UI primitives
- `/src/components/ui/composites/` - Composed custom UI building blocks
- `/src/app/globals.css` - Global tokens, reset, and utility classes

---

## Git Workflow

### Branch Strategy

- **Main Branch**: Production-ready code
- **Feature Branches**: `feature/description` or `fix/description`
- **Claude Branches**: Auto-generated `claude/claude-md-*` branches

### Before Committing

1. Run tests: `npm run test`
2. Check TypeScript: `npm run build`
3. Review changes: `git diff`

### Commit Process

```bash
# Stage changes
git add <files>

# Commit with descriptive message
git commit -m "Verb subject description"

# Push to remote
git push -u origin <branch-name>
```

### Pull Request Guidelines

1. Ensure tests pass
2. Update CLAUDE.md if adding new features
3. Reference any related issues
4. Request review from team

---

## Additional Resources

### Documentation
- [Next.js App Router Docs](https://nextjs.org/docs/app)
- [Prisma Documentation](https://www.prisma.io/docs)
- [NextAuth.js Docs](https://authjs.dev)
- [Stripe Connect Guide](https://stripe.com/docs/connect)
- [BullMQ Documentation](https://docs.bullmq.io)

### Internal Docs
- `/docs/ARCHITECTURE.md` - System architecture
- `/docs/QC_RUBRIC.md` - Quality control rules
- `/docs/Monet.postman_collection.json` - API testing collection
- `/README.md` - Quick start guide

### Getting Help

1. Check this CLAUDE.md first
2. Review existing code for patterns
3. Check test files for examples
4. Consult external documentation
5. Review recent commits for similar changes

---

## AI Assistant Guidelines

### When Making Changes

1. ✅ **Always read relevant files first** before making changes
2. ✅ **Follow existing patterns** in the codebase
3. ✅ **Update tests** when changing functionality
4. ✅ **Use TypeScript strictly** - no `any` types
5. ✅ **Validate inputs** with Zod schemas
6. ✅ **Handle errors** gracefully with try/catch
7. ✅ **Update this CLAUDE.md** when adding significant features

### Code Quality Checklist

- [ ] TypeScript types are explicit (no `any`)
- [ ] Errors are caught and handled
- [ ] API routes validate sessions
- [ ] Request bodies are validated with Zod
- [ ] Database queries use Prisma
- [ ] Timezone is handled correctly
- [ ] Tests are updated/added
- [ ] Feature flags are used for optional features
- [ ] Secrets are in environment variables (not hardcoded)
- [ ] New frontend UI is authored as custom components (no generated UI dependencies)
- [ ] Reusable UI is placed under `src/components/ui/primitives` or `src/components/ui/composites`

### Security Checklist

- [ ] Session validation on all protected routes
- [ ] SQL injection prevented (using Prisma)
- [ ] XSS prevented (React escapes by default)
- [ ] CSRF protection (NextAuth handles this)
- [ ] Sensitive data not logged
- [ ] Rate limiting on sensitive endpoints
- [ ] Stripe webhooks verify signatures

### Performance Checklist

- [ ] Database queries are indexed
- [ ] Use SQL views for complex joins
- [ ] Pagination for large datasets
- [ ] Background jobs for long-running tasks
- [ ] Caching where appropriate
- [ ] Image optimization (Next.js handles this)

---

## Changelog

| Date | Summary |
|------|---------|
| 2026-02-08 | Frontend architecture shift to custom HTML/CSS components: removed DevLink/Webflow guidance, added modular `components/ui/primitives` + `components/ui/composites` structure, and documented long-term component conventions |
| 2026-02-07 | Booking calendar refactor docs update: added `components/bookings/calendar|hooks|services`, slot-based candidate request payloads, manual Google refresh/override behavior, and professional reschedule review flow updates |
| 2026-01-19 | Webflow + DevLink integration: replaced React Bootstrap with DevLink as UI layer, added DevLink conventions and patterns |
| 2026-01-17 | Schema fixes (attendanceOutcome, candidateLateCancellation, PaymentStatus.cancelled/capture_failed), QC flow update to LLM-only (Claude API), success fee removal, async confirm-and-schedule pattern, webhook loopback fix |
| 2026-01-16 | Documentation accuracy fixes, Dispute model, attendance tracking, comprehensive schema documentation |
| 2026-01-11 | Payment flow (authorize→capture), Stripe Connect clarification, security patterns, state invariants, new workflows |
| 2025-11-19 | Refactoring cleanup, renamed `/schedule` to `/confirm-and-schedule`, removed `Slot` type alias |
| 2025-11-18 | Money handling: cents (Int) instead of dollars (Float), renamed `priceUSD` to `priceCents` |
| 2025-11-17 | API routes reorganization by role, folder structure reorganization, initial version |

For detailed changes, see git history.

---

**End of CLAUDE.md**

This document should be updated whenever significant architectural changes, new patterns, or major features are added to the codebase.
