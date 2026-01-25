# Monet 3.0

A full-stack marketplace platform connecting **Candidates** (job seekers) with **Professionals** (industry experts) for paid consultation calls. Built with Next.js, TypeScript, Prisma, and Stripe.

## Table of Contents

- [Local Development Setup](#local-development-setup)
- [Production Deployment](#production-deployment)
- [NPM Scripts Reference](#npm-scripts-reference)
- [Learn More](#learn-more)

---

## Local Development Setup

### Prerequisites

Ensure you have the following installed:

- **Node.js** 20+ ([download](https://nodejs.org/))
- **npm** (comes with Node.js)
- **Docker** and **Docker Compose** (for local Postgres + Redis)
- Alternatively, you can use standalone Postgres 14+ and Redis 6+ installations

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your configuration values. At minimum, you need:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:password@localhost:5432/monet` |
| `REDIS_URL` | Redis connection string (for BullMQ) | `redis://localhost:6379` |
| `AUTH_SECRET` | NextAuth secret key | Generate with `openssl rand -base64 32` |
| `STRIPE_SECRET_KEY` | Stripe secret key | `sk_test_...` |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | `pk_test_...` |

See `.env.example` for the full list of available environment variables including Google OAuth, Zoom integration, AWS SES/S3, and feature flags.

### Step 3: Start Docker Services (Postgres + Redis)

```bash
docker compose up -d
```

This starts:
- **PostgreSQL 15** on port `5432` (user: `user`, password: `password`, database: `monet`)
- **Redis 7** on port `6379`

> **Note**: Skip this step if you're using external Postgres/Redis instances. Just update the connection strings in `.env`.

### Step 4: Run Database Migrations

```bash
npx prisma migrate dev
```

This applies all migrations and generates the Prisma client.

### Step 5: Seed the Database (Optional but Recommended)

```bash
npm run seed
```

This populates the database with comprehensive test data for local development.

**Seeded Users:**

| Role | Emails | Password |
|------|--------|----------|
| Admin | admin@monet.local | admin123! |
| Candidates | cand1@monet.local through cand10@monet.local | cand123! |
| Professionals | pro1@monet.local through pro10@monet.local | pro123! |

**Additional Test Data:**
- **Availability**: 14 days of availability slots for all professionals
- **Bookings**: 6 bookings per professional in various states (requested, accepted, pending feedback)
- **Edge Cases**: 10 additional bookings covering declined, expired, cancelled, disputed, refunded, and reschedule scenarios

### Step 6: Start the Development Server

⚠️ **IMPORTANT**: You must run **two processes** simultaneously for full functionality.

**Terminal 1 — Next.js Dev Server:**
```bash
npm run dev
```

**Terminal 2 — BullMQ Queue Worker:**
```bash
npm run dev:queue
```

The queue worker handles background jobs including:
- QC validation jobs
- Email notifications
- Nudge reminders
- Payout processing
- Booking expiry

### Step 7: Access the Application

| URL | Description |
|-----|-------------|
| http://localhost:3000 | Landing page |
| http://localhost:3000/candidate/dashboard | Candidate Dashboard |
| http://localhost:3000/professional/dashboard | Professional Dashboard |
| http://localhost:3000/admin | Admin Portal |

---

## Production Deployment

### Recommended Architecture

| Component | Service | Notes |
|-----------|---------|-------|
| **Application** | Vercel | Next.js optimized hosting |
| **Database** | Supabase | Managed PostgreSQL |
| **Redis** | Upstash or Railway | For BullMQ job queue |
| **File Storage** | AWS S3 | Resume uploads |
| **Email** | AWS SES | Transactional emails |
| **Payments** | Stripe Connect | Separate charges and transfers |

### Step 1: Set Up External Services

1. **Supabase Database**
   - Create a new project at [supabase.com](https://supabase.com)
   - Copy the connection string from Settings → Database → Connection String
   - Use the "URI" format for `DATABASE_URL`

2. **Upstash Redis**
   - Create a Redis database at [upstash.com](https://upstash.com)
   - Copy the Redis URL for `REDIS_URL`

3. **Stripe**
   - Set up a Stripe account with Connect enabled
   - Use live keys (`sk_live_...`, `pk_live_...`) for production

4. **AWS Services** (Optional but recommended)
   - Create an S3 bucket for file uploads
   - Configure SES for email sending
   - Create IAM credentials with appropriate permissions

### Step 2: Deploy to Vercel

1. **Connect Repository**
   ```bash
   # Push to GitHub/GitLab/Bitbucket
   git push origin main
   ```

2. **Import to Vercel**
   - Go to [vercel.com](https://vercel.com) → New Project
   - Import your repository
   - Framework will be auto-detected as Next.js

3. **Configure Environment Variables**

   Add all required environment variables in Vercel's project settings:

   ```plaintext
   # Required
   DATABASE_URL=postgresql://...@supabase.co:5432/postgres
   REDIS_URL=rediss://...@upstash.io:6379
   AUTH_SECRET=<generate-secure-secret>
   NEXTAUTH_SECRET=<same-as-AUTH_SECRET>
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_PUBLISHABLE_KEY=pk_live_...
   
   # Integrations
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ZOOM_ACCOUNT_ID=...
   ZOOM_CLIENT_ID=...
   ZOOM_CLIENT_SECRET=...
   
   # AWS
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   AWS_S3_BUCKET=your-bucket-name
   
   # Optional Configuration
   PLATFORM_FEE=0.20
   CALL_DURATION_MINUTES=30
   DEFAULT_TIMEZONE=America/New_York
   FEATURE_QC_LLM=true
   ANTHROPIC_API_KEY=...
   ```

4. **Deploy**
   - Vercel will automatically build and deploy
   - Subsequent pushes to `main` trigger auto-deployments

### Step 3: Run Production Migrations

After first deployment, run migrations against your production database:

```bash
# Set production DATABASE_URL locally, then:
npx prisma migrate deploy
```

Or use Vercel's build command to run migrations automatically by updating `package.json`:

```json
{
  "scripts": {
    "build": "prisma migrate deploy && next build"
  }
}
```

### Step 4: Set Up Background Queue Worker

**Option A: Vercel Cron Jobs (Simple)**
- Use Vercel Cron to trigger queue processing endpoints
- Limited to scheduled intervals

**Option B: Separate Worker Process (Recommended)**
- Deploy `npm run dev:queue` as a separate service
- Use Railway, Render, or a dedicated VPS
- Ensure the worker has access to the same `REDIS_URL` and `DATABASE_URL`

### Production Build Commands

```bash
# Build for production
npm run build

# Start production server
npm run start
```

---

## NPM Scripts Reference

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js development server (port 3000) |
| `npm run dev:queue` | Start BullMQ background worker |
| `npm run build` | Create production build |
| `npm run start` | Start production server |
| `npm run seed` | Seed database with test data |
| `npm run test` | Run unit tests (Vitest) |
| `npm run lint` | Run ESLint |

---

## Learn More

- [CLAUDE.md](./CLAUDE.md) - Comprehensive project documentation and conventions
- [Next.js Documentation](https://nextjs.org/docs) - Next.js features and API
- [Prisma Documentation](https://www.prisma.io/docs) - Database ORM
- [Stripe Connect](https://stripe.com/docs/connect) - Payment processing
- [BullMQ](https://docs.bullmq.io/) - Background job queue
