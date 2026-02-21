import {
    PrismaClient,
    Role,
    BookingStatus,
    PaymentStatus,
    PayoutStatus,
    QCStatus,
    DisputeStatus,
    DisputeReason,
    AttendanceOutcome
} from '@prisma/client'
import bcrypt from 'bcryptjs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { uploadResume, RESUME_CONTENT_TYPE } from '../lib/integrations/resume-storage'

function normalizeEnvValue(rawValue: string | undefined): string | undefined {
    const trimmed = rawValue?.trim()
    if (!trimmed) return undefined

    if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
        const unquoted = trimmed.slice(1, -1).trim()
        return unquoted || undefined
    }

    return trimmed
}

const prisma = new PrismaClient()
type SeedPopulationMode = 'lite' | 'full'
const CANDIDATE_COUNT = 7
const PROFESSIONAL_COUNT = 7
const SAMPLE_RESUME_RELATIVE_PATH = 'src/app/PDF_sample.pdf'
const FULL_CANDIDATE_NUMBERS = Array.from({ length: CANDIDATE_COUNT }, (_, index) => index + 1)
const FULL_PROFESSIONAL_NUMBERS = Array.from({ length: PROFESSIONAL_COUNT }, (_, index) => index + 1)
const LITE_CANDIDATE_NUMBERS = [3]
const LITE_PROFESSIONAL_NUMBERS = [2]

// Helper to generate unique IDs for Stripe mocks
const generateStripeId = (prefix: string, index: number) => `${prefix}_test_${index.toString().padStart(3, '0')}`
const toArrayBuffer = (buffer: Buffer): ArrayBuffer => {
    const arrayBuffer = new ArrayBuffer(buffer.byteLength)
    new Uint8Array(arrayBuffer).set(buffer)
    return arrayBuffer
}

// Array of sample companies and titles for professionals
const COMPANIES = [
    { employer: 'Goldman Sachs', title: 'Vice President' },
    { employer: 'McKinsey & Company', title: 'Senior Consultant' },
    { employer: 'Google', title: 'Principal Engineer' },
    { employer: 'Meta', title: 'Product Manager' },
    { employer: 'Apple', title: 'Senior UX Designer' },
    { employer: 'Amazon', title: 'Principal Product Manager' },
    { employer: 'Bain & Company', title: 'Manager' },
    { employer: 'BCG', title: 'Project Leader' },
    { employer: 'JPMorgan', title: 'Executive Director' },
    { employer: 'Morgan Stanley', title: 'Managing Director' },
]

const INTERESTS = [
    ['Technology', 'Career Growth'],
    ['Finance', 'Investment Banking'],
    ['Consulting', 'Strategy'],
    ['Product Management', 'Startups'],
    ['Software Engineering', 'AI/ML'],
    ['UX Design', 'User Research'],
    ['Private Equity', 'Venture Capital'],
    ['Marketing', 'Brand Strategy'],
    ['Data Science', 'Analytics'],
    ['Operations', 'Supply Chain'],
]

const BIOS = [
    '10+ years of experience helping candidates navigate their career transitions. I have mentored over 50 candidates and seen them land offers at top-tier companies.',
    'Former consultant with deep expertise in strategy and operations. I love helping candidates prepare for case interviews and understand the consulting lifestyle.',
    'Passionate about mentoring the next generation of tech leaders. Built products used by millions and eager to share my learnings with aspiring engineers.',
    'Developed products used by billions of users globally. Happy to share insights on product sense, execution, and navigating big tech companies.',
    'Extensive experience in design thinking and user-centric development. Let me help you build a strong portfolio and ace your design interviews.',
    'Built and scaled products from 0 to 1 at multiple startups. I can help you understand the startup ecosystem and make informed career decisions.',
    'Spent a decade in M&A at top investment banks. Now helping candidates break into finance and understand the recruiting landscape.',
    'Expert in go-to-market strategy and B2B sales motions. Have built sales teams from scratch and can help you break into sales or marketing.',
    'Led data teams at Fortune 500 companies. Love coaching on analytics interviews, career paths, and how to become a data leader.',
    'Operations leader with experience across manufacturing, logistics, and supply chain. Can help candidates break into ops roles or understand MBA recruiting.',
]

// Schools for education data
const SCHOOLS = [
    { name: 'Harvard University', degree: 'MBA', field: 'Business Administration' },
    { name: 'Stanford University', degree: 'MS', field: 'Computer Science' },
    { name: 'Wharton School', degree: 'MBA', field: 'Finance' },
    { name: 'MIT', degree: 'BS', field: 'Electrical Engineering' },
    { name: 'Columbia University', degree: 'BA', field: 'Economics' },
    { name: 'Yale University', degree: 'JD', field: 'Law' },
    { name: 'Princeton University', degree: 'AB', field: 'Public Policy' },
    { name: 'University of Chicago', degree: 'MBA', field: 'Accounting' },
    { name: 'Duke University', degree: 'BS', field: 'Biology' },
    { name: 'Northwestern University', degree: 'MS', field: 'Marketing' },
]

const CANDIDATE_TIMEZONES = ['America/New_York', 'America/Los_Angeles', 'America/Chicago', 'Europe/London', 'Asia/Tokyo']
const PROFESSIONAL_TIMEZONES = ['America/New_York', 'America/Los_Angeles', 'America/Chicago', 'Europe/London', 'Asia/Singapore']
const ALL_BOOKING_STATUSES: BookingStatus[] = [
    BookingStatus.draft,
    BookingStatus.requested,
    BookingStatus.declined,
    BookingStatus.expired,
    BookingStatus.accepted,
    BookingStatus.accepted_pending_integrations,
    BookingStatus.reschedule_pending,
    BookingStatus.dispute_pending,
    BookingStatus.cancelled,
    BookingStatus.completed,
    BookingStatus.completed_pending_feedback,
    BookingStatus.refunded,
]

const STATUS_DAY_OFFSETS: Record<BookingStatus, number> = {
    [BookingStatus.draft]: 14,
    [BookingStatus.requested]: 7,
    [BookingStatus.declined]: 9,
    [BookingStatus.expired]: 8,
    [BookingStatus.accepted]: 3,
    [BookingStatus.accepted_pending_integrations]: 4,
    [BookingStatus.reschedule_pending]: 5,
    [BookingStatus.dispute_pending]: -2,
    [BookingStatus.cancelled]: 2,
    [BookingStatus.completed]: -12,
    [BookingStatus.completed_pending_feedback]: -3,
    [BookingStatus.refunded]: -9,
}

const escapeIdentifier = (value: string) => value.replace(/"/g, '""')

function parseSeedPopulationMode(): SeedPopulationMode {
    const rawValue = process.env.SEED_POPULATION_MODE?.trim()

    if (!rawValue) {
        return 'lite'
    }

    const normalized = rawValue.toLowerCase()
    if (normalized === 'lite' || normalized === 'full') {
        return normalized
    }

    throw new Error(`Invalid SEED_POPULATION_MODE="${rawValue}". Valid values are: lite, full.`)
}

function getUserNumbersForMode(mode: SeedPopulationMode) {
    if (mode === 'full') {
        return {
            candidateNumbers: FULL_CANDIDATE_NUMBERS,
            professionalNumbers: FULL_PROFESSIONAL_NUMBERS,
        }
    }

    return {
        candidateNumbers: LITE_CANDIDATE_NUMBERS,
        professionalNumbers: LITE_PROFESSIONAL_NUMBERS,
    }
}

function assertResumeUploadEnv() {
    const requiredEnvVars = ['STORAGE_SUPABASE_URL', 'STORAGE_SUPABASE_SERVICE_ROLE_KEY']
    const missing = requiredEnvVars.filter((envVar) => !normalizeEnvValue(process.env[envVar]))

    if (missing.length > 0) {
        throw new Error(`Missing required environment variable(s) for resume uploads: ${missing.join(', ')}.`)
    }
}

async function loadSampleResumePdf() {
    const resumePath = path.resolve(process.cwd(), SAMPLE_RESUME_RELATIVE_PATH)

    try {
        const sampleResumePdf = await readFile(resumePath)
        console.log(`📄 Loaded sample resume from ${SAMPLE_RESUME_RELATIVE_PATH}`)
        return sampleResumePdf
    } catch (error) {
        throw new Error(`Unable to read sample resume at ${resumePath}: ${(error as Error).message}`)
    }
}

async function clearDatabase() {
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename <> '_prisma_migrations'
    `

    if (tables.length === 0) {
        console.log('ℹ️  No tables found to clear')
        return
    }

    const quotedTables = tables
        .map(({ tablename }) => `"public"."${escapeIdentifier(tablename)}"`)
        .join(', ')

    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quotedTables} RESTART IDENTITY CASCADE;`)
    console.log(`🧹 Cleared ${tables.length} tables`)
}

async function main() {
    const populationMode = parseSeedPopulationMode()
    const { candidateNumbers, professionalNumbers } = getUserNumbersForMode(populationMode)

    console.log('Start seeding ...')
    console.log(`Seed population mode: ${populationMode}`)
    assertResumeUploadEnv()
    const sampleResumePdf = await loadSampleResumePdf()
    await clearDatabase()
    console.log('')

    // Hash passwords once
    const adminPassword = await bcrypt.hash('admin123!', 10)
    const candidatePassword = await bcrypt.hash('cand123!', 10)
    const professionalPassword = await bcrypt.hash('pro123!', 10)

    // Create Admin
    const admin = await prisma.user.upsert({
        where: { email: 'admin@monet.local' },
        update: {},
        create: {
            email: 'admin@monet.local',
            hashedPassword: adminPassword,
            role: Role.ADMIN,
            timezone: 'America/New_York',
        },
    })
    console.log(`✅ Created admin: ${admin.email}`)

    // Create candidates with varied profiles
    const candidates: { id: string; email: string; timezone: string }[] = []
    for (const i of candidateNumbers) {
        const email = `cand${i}@monet.local`
        const school = SCHOOLS[(i - 1) % SCHOOLS.length]
        const schoolSecondary = SCHOOLS[(i + 2) % SCHOOLS.length]
        const timezone = CANDIDATE_TIMEZONES[(i - 1) % CANDIDATE_TIMEZONES.length]
        const { storageUrl: seededResumeUrl } = await uploadResume(
            'signup',
            toArrayBuffer(sampleResumePdf),
            RESUME_CONTENT_TYPE
        )

        const candidate = await prisma.user.upsert({
            where: { email },
            update: {},
            create: {
                email,
                hashedPassword: candidatePassword,
                role: Role.CANDIDATE,
                timezone,
                stripeCustomerId: generateStripeId('cus', i),
                candidateProfile: {
                    create: {
                        interests: [...new Set([...INTERESTS[(i - 1) % INTERESTS.length], i % 2 === 0 ? 'Interview Prep' : 'Networking'])],
                        resumeUrl: seededResumeUrl,
                        education: {
                            create: [
                                {
                                    school: school.name,
                                    degree: school.degree,
                                    fieldOfStudy: school.field,
                                    startDate: new Date(`${2016 - i}-09-01`),
                                    endDate: new Date(`${2020 - i}-05-15`),
                                    gpa: 3.4 + (i % 5) * 0.1,
                                    honors: i % 3 === 0 ? 'Summa Cum Laude' : i % 3 === 1 ? 'Magna Cum Laude' : null,
                                    activities: ['Case Competition Club', 'Investment Club'],
                                },
                                {
                                    school: schoolSecondary.name,
                                    degree: i % 2 === 0 ? 'Certificate' : 'Exchange Program',
                                    fieldOfStudy: i % 2 === 0 ? 'Data Analytics' : schoolSecondary.field,
                                    startDate: new Date(`${2021 - i}-09-01`),
                                    endDate: new Date(`${2022 - i}-05-15`),
                                    gpa: i % 2 === 0 ? 3.8 : null,
                                    honors: null,
                                    activities: ['Mentorship Program', 'Professional Development Society'],
                                },
                            ],
                        },
                        experience: {
                            create: [
                                {
                                    company: `Previous Company ${i}`,
                                    title: i % 2 === 0 ? 'Business Analyst' : 'Product Intern',
                                    location: i % 2 === 0 ? 'New York, NY' : 'San Francisco, CA',
                                    startDate: new Date(`${2021 - i}-06-01`),
                                    endDate: new Date(`${2023 - i}-08-01`),
                                    isCurrent: false,
                                    description: 'Analyzed business data and provided strategic recommendations across cross-functional teams.',
                                    type: 'EXPERIENCE',
                                },
                                {
                                    company: `Current Company ${i}`,
                                    title: i % 3 === 0 ? 'Associate' : 'Analyst',
                                    location: i % 2 === 0 ? 'Remote' : 'Chicago, IL',
                                    startDate: new Date(`${2023 - i}-09-01`),
                                    isCurrent: i % 3 === 0,
                                    endDate: i % 3 === 0 ? null : new Date('2024-12-01'),
                                    description: 'Built reporting dashboards and partnered with senior stakeholders on project execution.',
                                    type: 'EXPERIENCE',
                                },
                            ],
                        },
                        activities: {
                            create: [
                                {
                                    company: 'Campus Organization',
                                    title: 'Mentor',
                                    startDate: new Date(`${2019 - i}-01-15`),
                                    endDate: new Date(`${2021 - i}-12-15`),
                                    isCurrent: false,
                                    description: 'Mentored underclassmen on recruiting prep and resume development.',
                                    type: 'ACTIVITY',
                                },
                                {
                                    company: 'Volunteer Program',
                                    title: 'Program Lead',
                                    startDate: new Date(`${2022 - i}-02-01`),
                                    isCurrent: i % 4 === 0,
                                    endDate: i % 4 === 0 ? null : new Date(`${2024 - i}-06-30`),
                                    description: 'Led volunteer onboarding and coordinated weekly professional development workshops.',
                                    type: 'ACTIVITY',
                                },
                            ],
                        },
                    },
                },
            },
        })
        candidates.push({ id: candidate.id, email: candidate.email, timezone })
        console.log(`✅ Created candidate: ${candidate.email}`)
    }

    // Create professionals with Stripe account IDs and varied profiles
    const professionals: { id: string; email: string; stripeAccountId: string; timezone: string }[] = []
    for (const i of professionalNumbers) {
        const email = `pro${i}@monet.local`
        const stripeAccountId = generateStripeId('acct', i)
        const company = COMPANIES[(i - 1) % COMPANIES.length]
        const bio = BIOS[(i - 1) % BIOS.length]
        const school = SCHOOLS[(i + 4) % SCHOOLS.length] // Different schools than candidates
        const schoolSecondary = SCHOOLS[(i + 6) % SCHOOLS.length]
        const timezone = PROFESSIONAL_TIMEZONES[(i - 1) % PROFESSIONAL_TIMEZONES.length]

        const professional = await prisma.user.upsert({
            where: { email },
            update: {},
            create: {
                email,
                hashedPassword: professionalPassword,
                role: Role.PROFESSIONAL,
                timezone,
                stripeAccountId,
                googleCalendarConnected: i % 2 === 0, // Half have Google Calendar connected
                linkedinConnected: i % 3 !== 0, // Most have LinkedIn connected
                corporateEmailVerified: true,
                professionalProfile: {
                    create: {
                        bio,
                        priceCents: 10000 + (i * 2500), // $125 to $350 range
                        corporateEmail: `pro${i}@${company.employer.toLowerCase().replace(/\s+/g, '')}.local`,
                        verifiedAt: new Date(),
                        interests: [...new Set([...INTERESTS[(i - 1) % INTERESTS.length], 'Mentorship'])],
                        availabilityPrefs: {
                            weekdays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
                            preferredTimes: ['morning', 'afternoon'],
                            maxCallsPerWeek: 5 + i,
                            minLeadHours: 24,
                            preferredSessionLengthMinutes: 30,
                        },
                        education: {
                            create: [
                                {
                                    school: school.name,
                                    degree: school.degree,
                                    fieldOfStudy: school.field,
                                    startDate: new Date(`${2008 - i}-09-01`),
                                    endDate: new Date(`${2012 - i}-05-15`),
                                    gpa: 3.7 + (i % 3) * 0.1,
                                    honors: i % 2 === 0 ? 'Dean\'s List' : null,
                                    activities: ['Student Government', 'Debate Team'],
                                },
                                {
                                    school: schoolSecondary.name,
                                    degree: i % 2 === 0 ? 'MBA' : 'Executive Certificate',
                                    fieldOfStudy: i % 2 === 0 ? 'General Management' : 'Leadership',
                                    startDate: new Date(`${2014 - i}-09-01`),
                                    endDate: new Date(`${2016 - i}-05-15`),
                                    gpa: i % 2 === 0 ? 3.8 : null,
                                    honors: null,
                                    activities: ['Alumni Mentorship Council'],
                                },
                            ],
                        },
                        experience: {
                            create: [
                                {
                                    company: company.employer,
                                    title: company.title,
                                    location: i % 2 === 0 ? 'New York, NY' : 'Remote',
                                    startDate: new Date(`${2020 - (i % 3)}-01-01`),
                                    isCurrent: true,
                                    description: `Leading strategic initiatives and mentoring junior team members at ${company.employer}.`,
                                    type: 'EXPERIENCE',
                                    positionHistory: [
                                        { title: 'Associate', startDate: '2018-01-01', endDate: '2020-01-01' },
                                        { title: 'Manager', startDate: '2020-01-01', endDate: null },
                                    ],
                                },
                                {
                                    company: COMPANIES[(i + 3) % COMPANIES.length].employer,
                                    title: 'Associate',
                                    location: 'Boston, MA',
                                    startDate: new Date('2016-01-01'),
                                    endDate: new Date('2020-01-01'),
                                    isCurrent: false,
                                    description: 'Started career in a rotational program, building foundational skills.',
                                    type: 'EXPERIENCE',
                                },
                                {
                                    company: `Startup Portfolio ${i}`,
                                    title: 'Advisor',
                                    location: 'Part-time / Remote',
                                    startDate: new Date(`${2021 - (i % 2)}-03-01`),
                                    isCurrent: true,
                                    description: 'Advises early-stage founders on product strategy and hiring.',
                                    type: 'EXPERIENCE',
                                },
                            ],
                        },
                        activities: {
                            create: [
                                {
                                    company: 'Professional Association',
                                    title: 'Panel Speaker',
                                    startDate: new Date(`${2018 - i}-02-01`),
                                    endDate: new Date(`${2024 - i}-11-15`),
                                    isCurrent: false,
                                    description: 'Hosts quarterly workshops for candidates on interview strategy.',
                                    type: 'ACTIVITY',
                                },
                                {
                                    company: 'Mentorship Circle',
                                    title: 'Career Coach',
                                    startDate: new Date(`${2020 - i}-01-01`),
                                    isCurrent: true,
                                    description: 'Runs monthly office hours and mock interview cohorts.',
                                    type: 'ACTIVITY',
                                },
                            ],
                        },
                    },
                },
            },
        })
        professionals.push({ id: professional.id, email: professional.email, stripeAccountId, timezone })
        console.log(`✅ Created professional: ${professional.email}`)
    }

    if (candidates.length === 0 || professionals.length === 0) {
        throw new Error('Seed configuration must include at least one candidate and one professional.')
    }

    // Create baseline availability slots for candidates
    console.log('')
    console.log('Creating candidate availability slots...')
    const now = new Date()
    for (const candidate of candidates) {
        // Create availability for next 14 days
        for (let day = 1; day <= 14; day++) {
            const date = new Date(now)
            date.setDate(date.getDate() + day)
            date.setHours(10, 0, 0, 0) // 10 AM baseline candidate availability

            // Skip weekends to mimic standard weekday scheduling behavior
            const dayOfWeek = date.getDay()
            if (dayOfWeek === 0 || dayOfWeek === 6) continue

            // Create 2-3 one-hour candidate slots per day
            for (let slot = 0; slot < (day % 2 === 0 ? 3 : 2); slot++) {
                const startTime = new Date(date)
                startTime.setHours(10 + slot * 2) // 10am, 12pm, 2pm

                const endTime = new Date(startTime)
                endTime.setHours(endTime.getHours() + 1)

                await prisma.availability.create({
                    data: {
                        userId: candidate.id,
                        start: startTime,
                        end: endTime,
                        busy: false,
                        timezone: candidate.timezone,
                    },
                })
            }
        }
    }
    console.log(`✅ Created baseline availability slots for all candidates`)

    // Create bookings for each professional
    console.log('')
    console.log('Creating bookings...')

    let bookingIndex = 0
    const baseDate = new Date()
    const candidateAvailabilitySeeded = new Set<string>()
    let statusMatrixBookingCount = 0
    let statusMatrixStripeIndex = 2000

    const createCandidateRequestAvailability = async (
        candidate: { id: string; timezone: string },
        anchorStart: Date,
        includeBusyBlock: boolean = false
    ) => {
        const slotOffsetsInMinutes = [-90, 0, 90]

        for (const offset of slotOffsetsInMinutes) {
            const start = new Date(anchorStart.getTime() + offset * 60 * 1000)
            const end = new Date(start.getTime() + 60 * 60 * 1000)
            await prisma.availability.create({
                data: {
                    userId: candidate.id,
                    start,
                    end,
                    busy: false,
                    timezone: candidate.timezone,
                },
            })
        }

        if (includeBusyBlock) {
            const busyStart = new Date(anchorStart.getTime() + 30 * 60 * 1000)
            const busyEnd = new Date(busyStart.getTime() + 30 * 60 * 1000)
            await prisma.availability.create({
                data: {
                    userId: candidate.id,
                    start: busyStart,
                    end: busyEnd,
                    busy: true,
                    timezone: candidate.timezone,
                },
            })
        }
    }

    const createStatusMatrixBooking = async (
        candidate: { id: string; timezone: string },
        professional: { id: string; stripeAccountId: string; timezone: string },
        status: BookingStatus,
        pairIndex: number,
        statusIndex: number
    ) => {
        const startAt = new Date(baseDate)
        startAt.setDate(startAt.getDate() + STATUS_DAY_OFFSETS[status] + (pairIndex % 5))
        startAt.setHours(8 + (statusIndex % 10), (pairIndex * 7) % 60, 0, 0)

        const endAt = new Date(startAt.getTime() + 60 * 60 * 1000)
        const priceCents = 10000 + ((pairIndex + statusIndex) % 8) * 1250
        const paymentIndex = statusMatrixStripeIndex++

        if (status === BookingStatus.draft) {
            await prisma.booking.create({
                data: {
                    candidateId: candidate.id,
                    professionalId: professional.id,
                    status,
                    priceCents,
                    timezone: candidate.timezone,
                },
            })
            return
        }

        if (status === BookingStatus.requested) {
            await prisma.booking.create({
                data: {
                    candidateId: candidate.id,
                    professionalId: professional.id,
                    status,
                    priceCents,
                    startAt,
                    endAt,
                    expiresAt: new Date(startAt.getTime() + 2 * 24 * 60 * 60 * 1000),
                    timezone: candidate.timezone,
                    payment: {
                        create: {
                            amountGross: priceCents,
                            platformFee: Math.floor(priceCents * 0.15),
                            stripePaymentIntentId: generateStripeId('pi', paymentIndex),
                            status: PaymentStatus.authorized,
                        },
                    },
                },
            })
            return
        }

        if (status === BookingStatus.declined) {
            await prisma.booking.create({
                data: {
                    candidateId: candidate.id,
                    professionalId: professional.id,
                    status,
                    priceCents,
                    startAt,
                    endAt,
                    declineReason: 'Sample matrix decline for status coverage.',
                    timezone: candidate.timezone,
                    payment: {
                        create: {
                            amountGross: priceCents,
                            platformFee: Math.floor(priceCents * 0.15),
                            stripePaymentIntentId: generateStripeId('pi', paymentIndex),
                            status: PaymentStatus.cancelled,
                        },
                    },
                },
            })
            return
        }

        if (status === BookingStatus.expired) {
            await prisma.booking.create({
                data: {
                    candidateId: candidate.id,
                    professionalId: professional.id,
                    status,
                    priceCents,
                    startAt,
                    endAt,
                    expiresAt: new Date(baseDate.getTime() - 60 * 60 * 1000),
                    timezone: candidate.timezone,
                    payment: {
                        create: {
                            amountGross: priceCents,
                            platformFee: Math.floor(priceCents * 0.15),
                            stripePaymentIntentId: generateStripeId('pi', paymentIndex),
                            status: PaymentStatus.cancelled,
                        },
                    },
                },
            })
            return
        }

        if (status === BookingStatus.accepted) {
            await prisma.booking.create({
                data: {
                    candidateId: candidate.id,
                    professionalId: professional.id,
                    status,
                    priceCents,
                    startAt,
                    endAt,
                    timezone: candidate.timezone,
                    zoomMeetingId: `zoom_matrix_accepted_${pairIndex}_${statusIndex}`,
                    zoomJoinUrl: `https://zoom.us/j/matrixaccepted${pairIndex}${statusIndex}`,
                    payment: {
                        create: {
                            amountGross: priceCents,
                            platformFee: Math.floor(priceCents * 0.15),
                            stripePaymentIntentId: generateStripeId('pi', paymentIndex),
                            status: PaymentStatus.held,
                        },
                    },
                },
            })
            return
        }

        if (status === BookingStatus.accepted_pending_integrations) {
            await prisma.booking.create({
                data: {
                    candidateId: candidate.id,
                    professionalId: professional.id,
                    status,
                    priceCents,
                    startAt,
                    endAt,
                    timezone: candidate.timezone,
                    payment: {
                        create: {
                            amountGross: priceCents,
                            platformFee: Math.floor(priceCents * 0.15),
                            stripePaymentIntentId: generateStripeId('pi', paymentIndex),
                            status: PaymentStatus.held,
                        },
                    },
                },
            })
            return
        }

        if (status === BookingStatus.reschedule_pending) {
            await prisma.booking.create({
                data: {
                    candidateId: candidate.id,
                    professionalId: professional.id,
                    status,
                    priceCents,
                    startAt,
                    endAt,
                    timezone: candidate.timezone,
                    zoomMeetingId: `zoom_matrix_reschedule_${pairIndex}_${statusIndex}`,
                    zoomJoinUrl: `https://zoom.us/j/matrixreschedule${pairIndex}${statusIndex}`,
                    payment: {
                        create: {
                            amountGross: priceCents,
                            platformFee: Math.floor(priceCents * 0.15),
                            stripePaymentIntentId: generateStripeId('pi', paymentIndex),
                            status: PaymentStatus.held,
                        },
                    },
                },
            })
            return
        }

        if (status === BookingStatus.dispute_pending) {
            await prisma.booking.create({
                data: {
                    candidateId: candidate.id,
                    professionalId: professional.id,
                    status,
                    priceCents,
                    startAt,
                    endAt,
                    timezone: candidate.timezone,
                    zoomMeetingId: `zoom_matrix_dispute_${pairIndex}_${statusIndex}`,
                    zoomJoinUrl: `https://zoom.us/j/matrixdispute${pairIndex}${statusIndex}`,
                    candidateJoinedAt: startAt,
                    professionalJoinedAt: null,
                    attendanceOutcome: AttendanceOutcome.professional_no_show,
                    payment: {
                        create: {
                            amountGross: priceCents,
                            platformFee: Math.floor(priceCents * 0.15),
                            stripePaymentIntentId: generateStripeId('pi', paymentIndex),
                            status: PaymentStatus.held,
                        },
                    },
                    payout: {
                        create: {
                            proStripeAccountId: professional.stripeAccountId,
                            amountNet: priceCents - Math.floor(priceCents * 0.15),
                            status: PayoutStatus.blocked,
                            reason: 'Status matrix dispute hold',
                        },
                    },
                    dispute: {
                        create: {
                            initiatorId: candidate.id,
                            reason: DisputeReason.no_show,
                            description: 'Status matrix seed: professional no-show dispute.',
                            status: DisputeStatus.open,
                        },
                    },
                },
            })
            return
        }

        if (status === BookingStatus.cancelled) {
            await prisma.booking.create({
                data: {
                    candidateId: candidate.id,
                    professionalId: professional.id,
                    status,
                    priceCents,
                    startAt,
                    endAt,
                    timezone: candidate.timezone,
                    refundCreatedAt: new Date(baseDate.getTime() - 2 * 60 * 60 * 1000),
                    payment: {
                        create: {
                            amountGross: priceCents,
                            platformFee: Math.floor(priceCents * 0.15),
                            refundedAmountCents: priceCents,
                            stripePaymentIntentId: generateStripeId('pi', paymentIndex),
                            stripeRefundId: generateStripeId('re', paymentIndex),
                            status: PaymentStatus.refunded,
                        },
                    },
                },
            })
            return
        }

        if (status === BookingStatus.completed) {
            await prisma.booking.create({
                data: {
                    candidateId: candidate.id,
                    professionalId: professional.id,
                    status,
                    priceCents,
                    startAt,
                    endAt,
                    timezone: candidate.timezone,
                    zoomMeetingId: `zoom_matrix_completed_${pairIndex}_${statusIndex}`,
                    zoomJoinUrl: `https://zoom.us/j/matrixcompleted${pairIndex}${statusIndex}`,
                    candidateJoinedAt: startAt,
                    professionalJoinedAt: new Date(startAt.getTime() + 2 * 60 * 1000),
                    attendanceOutcome: AttendanceOutcome.both_joined,
                    payoutReleasedAt: new Date(startAt.getTime() + 2 * 24 * 60 * 60 * 1000),
                    payment: {
                        create: {
                            amountGross: priceCents,
                            platformFee: Math.floor(priceCents * 0.15),
                            stripePaymentIntentId: generateStripeId('pi', paymentIndex),
                            status: PaymentStatus.released,
                        },
                    },
                    payout: {
                        create: {
                            proStripeAccountId: professional.stripeAccountId,
                            amountNet: priceCents - Math.floor(priceCents * 0.15),
                            status: PayoutStatus.paid,
                            stripeTransferId: generateStripeId('tr', paymentIndex),
                            paidAt: new Date(startAt.getTime() + 2 * 24 * 60 * 60 * 1000),
                        },
                    },
                },
            })
            return
        }

        if (status === BookingStatus.completed_pending_feedback) {
            await prisma.booking.create({
                data: {
                    candidateId: candidate.id,
                    professionalId: professional.id,
                    status,
                    priceCents,
                    startAt,
                    endAt,
                    timezone: candidate.timezone,
                    zoomMeetingId: `zoom_matrix_pending_feedback_${pairIndex}_${statusIndex}`,
                    zoomJoinUrl: `https://zoom.us/j/matrixpendingfeedback${pairIndex}${statusIndex}`,
                    candidateJoinedAt: startAt,
                    professionalJoinedAt: new Date(startAt.getTime() + 1 * 60 * 1000),
                    attendanceOutcome: AttendanceOutcome.both_joined,
                    lastNudgeSentAt: new Date(baseDate.getTime() - 24 * 60 * 60 * 1000),
                    payment: {
                        create: {
                            amountGross: priceCents,
                            platformFee: Math.floor(priceCents * 0.15),
                            stripePaymentIntentId: generateStripeId('pi', paymentIndex),
                            status: PaymentStatus.held,
                        },
                    },
                },
            })
            return
        }

        if (status === BookingStatus.refunded) {
            await prisma.booking.create({
                data: {
                    candidateId: candidate.id,
                    professionalId: professional.id,
                    status,
                    priceCents,
                    startAt,
                    endAt,
                    timezone: candidate.timezone,
                    zoomMeetingId: `zoom_matrix_refunded_${pairIndex}_${statusIndex}`,
                    zoomJoinUrl: `https://zoom.us/j/matrixrefunded${pairIndex}${statusIndex}`,
                    candidateJoinedAt: startAt,
                    professionalJoinedAt: new Date(startAt.getTime() + 2 * 60 * 1000),
                    attendanceOutcome: AttendanceOutcome.both_joined,
                    refundCreatedAt: new Date(startAt.getTime() + 24 * 60 * 60 * 1000),
                    payment: {
                        create: {
                            amountGross: priceCents,
                            platformFee: Math.floor(priceCents * 0.15),
                            refundedAmountCents: priceCents,
                            stripePaymentIntentId: generateStripeId('pi', paymentIndex),
                            stripeRefundId: generateStripeId('re', paymentIndex),
                            status: PaymentStatus.refunded,
                        },
                    },
                    dispute: {
                        create: {
                            initiatorId: candidate.id,
                            reason: DisputeReason.quality,
                            description: 'Status matrix seed: refund after quality dispute.',
                            status: DisputeStatus.resolved,
                            resolution: 'Full refund issued in status matrix seed.',
                            resolvedAt: new Date(startAt.getTime() + 24 * 60 * 60 * 1000),
                            resolvedById: admin.id,
                        },
                    },
                },
            })
        }
    }

    for (let proIndex = 0; proIndex < professionals.length; proIndex++) {
        const professional = professionals[proIndex]

        // Calculate which candidates to use for this professional
        const startCandidateIndex = (proIndex * 6) % candidates.length

        const getCandidateForBooking = (offset: number) => {
            return candidates[(startCandidateIndex + offset) % candidates.length]
        }

        const priceCents = 10000 + (proIndex * 2500)

        // ============================================
        // 2 Pending Requests (status: requested)
        // ============================================
        for (let i = 0; i < 2; i++) {
            const candidate = getCandidateForBooking(i)
            const scheduledDate = new Date(baseDate)
            scheduledDate.setDate(scheduledDate.getDate() + 7 + i)
            scheduledDate.setHours(10 + i, 0, 0, 0)

            const expiresAt = new Date(baseDate)
            expiresAt.setDate(expiresAt.getDate() + 5)

            await prisma.booking.create({
                data: {
                    candidateId: candidate.id,
                    professionalId: professional.id,
                    status: BookingStatus.requested,
                    priceCents,
                    startAt: scheduledDate,
                    endAt: new Date(scheduledDate.getTime() + 60 * 60 * 1000),
                    expiresAt,
                    timezone: candidate.timezone,
                    payment: {
                        create: {
                            amountGross: priceCents,
                            platformFee: Math.floor(priceCents * 0.15),
                            stripePaymentIntentId: generateStripeId('pi', bookingIndex),
                            status: PaymentStatus.authorized,
                        },
                    },
                },
            })
            await createCandidateRequestAvailability(candidate, scheduledDate, i % 2 === 0 && !candidateAvailabilitySeeded.has(candidate.id))
            candidateAvailabilitySeeded.add(candidate.id)
            bookingIndex++
        }

        // ============================================
        // 2 Accepted Bookings (status: accepted)
        // ============================================
        for (let i = 0; i < 2; i++) {
            const candidate = getCandidateForBooking(2 + i)
            const scheduledDate = new Date(baseDate)
            scheduledDate.setDate(scheduledDate.getDate() + 3 + i)
            scheduledDate.setHours(14 + i, 0, 0, 0)

            await prisma.booking.create({
                data: {
                    candidateId: candidate.id,
                    professionalId: professional.id,
                    status: BookingStatus.accepted,
                    priceCents,
                    startAt: scheduledDate,
                    endAt: new Date(scheduledDate.getTime() + 60 * 60 * 1000),
                    timezone: professional.timezone,
                    zoomMeetingId: `zoom_${bookingIndex}`,
                    zoomJoinUrl: `https://zoom.us/j/${100000000 + bookingIndex}`,
                    payment: {
                        create: {
                            amountGross: priceCents,
                            platformFee: Math.floor(priceCents * 0.15),
                            stripePaymentIntentId: generateStripeId('pi', bookingIndex),
                            status: PaymentStatus.held,
                        },
                    },
                },
            })
            bookingIndex++
        }

        // ============================================
        // 2 Calls Pending Feedback (status: completed_pending_feedback)
        // ============================================
        for (let i = 0; i < 2; i++) {
            const candidate = getCandidateForBooking(4 + i)
            const pastDate = new Date(baseDate)
            pastDate.setDate(pastDate.getDate() - (2 + i))
            pastDate.setHours(11 + i, 0, 0, 0)

            await prisma.booking.create({
                data: {
                    candidateId: candidate.id,
                    professionalId: professional.id,
                    status: BookingStatus.completed_pending_feedback,
                    priceCents,
                    startAt: pastDate,
                    endAt: new Date(pastDate.getTime() + 60 * 60 * 1000),
                    timezone: professional.timezone,
                    zoomMeetingId: `zoom_${bookingIndex}`,
                    zoomJoinUrl: `https://zoom.us/j/${100000000 + bookingIndex}`,
                    candidateJoinedAt: pastDate,
                    professionalJoinedAt: new Date(pastDate.getTime() + 2 * 60 * 1000), // Joined 2 min late
                    attendanceOutcome: AttendanceOutcome.both_joined,
                    payment: {
                        create: {
                            amountGross: priceCents,
                            platformFee: Math.floor(priceCents * 0.15),
                            stripePaymentIntentId: generateStripeId('pi', bookingIndex),
                            status: PaymentStatus.held,
                        },
                    },
                },
            })
            bookingIndex++
        }

        console.log(`📚 Created 6 bookings for ${professional.email}`)
    }

    // ============================================
    // ADDITIONAL EDGE CASES FOR TESTING
    // ============================================
    console.log('')
    console.log('Creating edge case bookings...')
    const candidateAt = (idx: number) => {
        if (candidates.length === 0) {
            throw new Error('Seed configuration error: no candidates were created.')
        }
        return candidates[idx % candidates.length]
    }
    const professionalAt = (idx: number) => {
        if (professionals.length === 0) {
            throw new Error('Seed configuration error: no professionals were created.')
        }
        return professionals[idx % professionals.length]
    }

    // 1. Completed booking with feedback and payout (QC passed)
    const completedBooking = await prisma.booking.create({
        data: {
            candidateId: candidateAt(0).id,
            professionalId: professionalAt(0).id,
            status: BookingStatus.completed,
            priceCents: 12500,
            startAt: new Date(baseDate.getTime() - 7 * 24 * 60 * 60 * 1000),
            endAt: new Date(baseDate.getTime() - 7 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
            timezone: 'America/New_York',
            zoomMeetingId: `zoom_completed_1`,
            zoomJoinUrl: `https://zoom.us/j/completed1`,
            candidateJoinedAt: new Date(baseDate.getTime() - 7 * 24 * 60 * 60 * 1000),
            professionalJoinedAt: new Date(baseDate.getTime() - 7 * 24 * 60 * 60 * 1000),
            attendanceOutcome: AttendanceOutcome.both_joined,
            payoutReleasedAt: new Date(baseDate.getTime() - 5 * 24 * 60 * 60 * 1000),
            payment: {
                create: {
                    amountGross: 12500,
                    platformFee: 1875,
                    stripePaymentIntentId: generateStripeId('pi', 998),
                    status: PaymentStatus.released,
                },
            },
            payout: {
                create: {
                    proStripeAccountId: professionalAt(0).stripeAccountId,
                    amountNet: 10625, // 12500 - 1875
                    status: PayoutStatus.paid,
                    stripeTransferId: generateStripeId('tr', 998),
                    paidAt: new Date(baseDate.getTime() - 5 * 24 * 60 * 60 * 1000),
                },
            },
            feedback: {
                create: {
                    text: 'The call went exceptionally well. The candidate showed strong analytical skills and asked insightful questions about the role. I provided detailed feedback on their approach to case interviews and recommended specific resources for improvement. We discussed typical day-to-day activities, career progression paths, and how to best position themselves for recruiting. The candidate has a solid background and with some targeted preparation, should be competitive for top firms. Key areas to work on include structuring responses more concisely and developing stronger market sizing intuition. Overall, a very productive conversation.',
                    summary: 'Strong candidate with good analytical skills. Needs work on structuring.',
                    actions: ['Practice market sizing cases', 'Work on executive communication', 'Research target firms deeply'],
                    wordCount: 112,
                    contentRating: 5,
                    deliveryRating: 4,
                    valueRating: 5,
                    qcStatus: QCStatus.passed,
                    submittedAt: new Date(baseDate.getTime() - 6 * 24 * 60 * 60 * 1000),
                },
            },
            professionalRating: {
                create: {
                    rating: 5,
                    text: 'Fantastic conversation! Very helpful insights into the consulting industry. Highly recommend.',
                    submittedAt: new Date(baseDate.getTime() - 6 * 24 * 60 * 60 * 1000),
                },
            },
        },
    })
    console.log(`✅ Created completed booking with feedback and payout`)

    // 2. Declined booking
    await prisma.booking.create({
        data: {
            candidateId: candidateAt(1).id,
            professionalId: professionalAt(1).id,
            status: BookingStatus.declined,
            priceCents: 12500,
            startAt: new Date(baseDate.getTime() + 5 * 24 * 60 * 60 * 1000),
            endAt: new Date(baseDate.getTime() + 5 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
            declineReason: 'Unfortunately, I have a scheduling conflict during this time. Please try booking at a different time.',
            timezone: 'America/New_York',
            payment: {
                create: {
                    amountGross: 12500,
                    platformFee: 1875,
                    stripePaymentIntentId: generateStripeId('pi', 997),
                    status: PaymentStatus.cancelled, // Authorization released
                },
            },
        },
    })
    console.log(`✅ Created declined booking`)

    // 3. Expired booking (professional didn't respond in time)
    await prisma.booking.create({
        data: {
            candidateId: candidateAt(2).id,
            professionalId: professionalAt(2).id,
            status: BookingStatus.expired,
            priceCents: 15000,
            startAt: new Date(baseDate.getTime() + 10 * 24 * 60 * 60 * 1000),
            endAt: new Date(baseDate.getTime() + 10 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
            expiresAt: new Date(baseDate.getTime() - 1 * 24 * 60 * 60 * 1000), // Expired yesterday
            timezone: 'America/New_York',
            payment: {
                create: {
                    amountGross: 15000,
                    platformFee: 2250,
                    stripePaymentIntentId: generateStripeId('pi', 996),
                    status: PaymentStatus.cancelled,
                },
            },
        },
    })
    console.log(`✅ Created expired booking`)

    // 4. Cancelled booking (by candidate)
    await prisma.booking.create({
        data: {
            candidateId: candidateAt(3).id,
            professionalId: professionalAt(3).id,
            status: BookingStatus.cancelled,
            priceCents: 17500,
            startAt: new Date(baseDate.getTime() + 2 * 24 * 60 * 60 * 1000),
            endAt: new Date(baseDate.getTime() + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
            timezone: 'America/New_York',
            zoomMeetingId: `zoom_cancelled_1`,
            zoomJoinUrl: `https://zoom.us/j/cancelled1`,
            payment: {
                create: {
                    amountGross: 17500,
                    platformFee: 2625,
                    stripePaymentIntentId: generateStripeId('pi', 995),
                    status: PaymentStatus.refunded,
                    refundedAmountCents: 17500,
                    stripeRefundId: generateStripeId('re', 995),
                },
            },
            refundCreatedAt: new Date(baseDate.getTime() - 1 * 24 * 60 * 60 * 1000),
        },
    })
    console.log(`✅ Created cancelled booking with refund`)

    // 5. Late cancellation by candidate (professional should still get paid)
    await prisma.booking.create({
        data: {
            candidateId: candidateAt(4).id,
            professionalId: professionalAt(4).id,
            status: BookingStatus.cancelled,
            priceCents: 20000,
            startAt: new Date(baseDate.getTime() - 2 * 60 * 60 * 1000), // Was 2 hours ago
            endAt: new Date(baseDate.getTime() - 1 * 60 * 60 * 1000),
            candidateLateCancellation: true,
            timezone: 'America/New_York',
            zoomMeetingId: `zoom_late_cancel_1`,
            zoomJoinUrl: `https://zoom.us/j/latecancel1`,
            payoutReleasedAt: new Date(),
            payment: {
                create: {
                    amountGross: 20000,
                    platformFee: 3000,
                    stripePaymentIntentId: generateStripeId('pi', 994),
                    status: PaymentStatus.released,
                },
            },
            payout: {
                create: {
                    proStripeAccountId: professionalAt(4).stripeAccountId,
                    amountNet: 17000,
                    status: PayoutStatus.paid,
                    stripeTransferId: generateStripeId('tr', 994),
                    paidAt: new Date(),
                },
            },
        },
    })
    console.log(`✅ Created late cancellation with payout`)

    // 6. Booking with open dispute
    const disputedBooking = await prisma.booking.create({
        data: {
            candidateId: candidateAt(5).id,
            professionalId: professionalAt(5).id,
            status: BookingStatus.dispute_pending,
            priceCents: 15000,
            startAt: new Date(baseDate.getTime() - 3 * 24 * 60 * 60 * 1000),
            endAt: new Date(baseDate.getTime() - 3 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
            timezone: 'America/New_York',
            zoomMeetingId: `zoom_dispute_1`,
            zoomJoinUrl: `https://zoom.us/j/dispute1`,
            candidateJoinedAt: new Date(baseDate.getTime() - 3 * 24 * 60 * 60 * 1000),
            professionalJoinedAt: null, // Professional didn't join
            attendanceOutcome: AttendanceOutcome.professional_no_show,
            payment: {
                create: {
                    amountGross: 15000,
                    platformFee: 2250,
                    stripePaymentIntentId: generateStripeId('pi', 993),
                    status: PaymentStatus.held, // Still held pending dispute resolution
                },
            },
            payout: {
                create: {
                    proStripeAccountId: professionalAt(5).stripeAccountId,
                    amountNet: 12750,
                    status: PayoutStatus.blocked,
                    reason: 'Dispute pending - professional no-show',
                },
            },
            dispute: {
                create: {
                    initiatorId: candidateAt(5).id,
                    reason: DisputeReason.no_show,
                    description: 'The professional did not show up for the scheduled call. I waited for 15 minutes but they never joined.',
                    status: DisputeStatus.open,
                },
            },
        },
    })
    console.log(`✅ Created booking with open dispute`)

    // 7. Booking with feedback requiring revision (QC: revise)
    await prisma.booking.create({
        data: {
            candidateId: candidateAt(6).id,
            professionalId: professionalAt(6).id,
            status: BookingStatus.completed_pending_feedback,
            priceCents: 12500,
            startAt: new Date(baseDate.getTime() - 4 * 24 * 60 * 60 * 1000),
            endAt: new Date(baseDate.getTime() - 4 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
            timezone: 'America/New_York',
            zoomMeetingId: `zoom_qc_revise_1`,
            zoomJoinUrl: `https://zoom.us/j/qcrevise1`,
            candidateJoinedAt: new Date(baseDate.getTime() - 4 * 24 * 60 * 60 * 1000),
            professionalJoinedAt: new Date(baseDate.getTime() - 4 * 24 * 60 * 60 * 1000),
            attendanceOutcome: AttendanceOutcome.both_joined,
            lastNudgeSentAt: new Date(baseDate.getTime() - 2 * 24 * 60 * 60 * 1000),
            payment: {
                create: {
                    amountGross: 12500,
                    platformFee: 1875,
                    stripePaymentIntentId: generateStripeId('pi', 992),
                    status: PaymentStatus.held,
                },
            },
            feedback: {
                create: {
                    text: 'Good call. Candidate has potential.',
                    summary: 'Too brief.',
                    actions: ['Study more', 'Practice', 'Improve'],
                    wordCount: 6, // Way below 200 word minimum
                    contentRating: 3,
                    deliveryRating: 3,
                    valueRating: 3,
                    qcStatus: QCStatus.revise,
                    submittedAt: new Date(baseDate.getTime() - 3 * 24 * 60 * 60 * 1000),
                },
            },
        },
    })
    console.log(`✅ Created booking with QC revise status`)

    // 8. Candidate no-show booking
    await prisma.booking.create({
        data: {
            candidateId: candidateAt(7).id,
            professionalId: professionalAt(7).id,
            status: BookingStatus.completed,
            priceCents: 15000,
            startAt: new Date(baseDate.getTime() - 5 * 24 * 60 * 60 * 1000),
            endAt: new Date(baseDate.getTime() - 5 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
            timezone: 'America/New_York',
            zoomMeetingId: `zoom_cand_noshow_1`,
            zoomJoinUrl: `https://zoom.us/j/candnoshow1`,
            candidateJoinedAt: null,
            professionalJoinedAt: new Date(baseDate.getTime() - 5 * 24 * 60 * 60 * 1000),
            attendanceOutcome: AttendanceOutcome.candidate_no_show,
            payoutReleasedAt: new Date(baseDate.getTime() - 4 * 24 * 60 * 60 * 1000),
            payment: {
                create: {
                    amountGross: 15000,
                    platformFee: 2250,
                    stripePaymentIntentId: generateStripeId('pi', 991),
                    status: PaymentStatus.released,
                },
            },
            payout: {
                create: {
                    proStripeAccountId: professionalAt(7).stripeAccountId,
                    amountNet: 12750,
                    status: PayoutStatus.paid,
                    stripeTransferId: generateStripeId('tr', 991),
                    paidAt: new Date(baseDate.getTime() - 4 * 24 * 60 * 60 * 1000),
                },
            },
        },
    })
    console.log(`✅ Created candidate no-show booking`)

    // 9. Resolved dispute (refunded)
    const resolvedDispute = await prisma.booking.create({
        data: {
            candidateId: candidateAt(8).id,
            professionalId: professionalAt(8).id,
            status: BookingStatus.refunded,
            priceCents: 17500,
            startAt: new Date(baseDate.getTime() - 10 * 24 * 60 * 60 * 1000),
            endAt: new Date(baseDate.getTime() - 10 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
            timezone: 'America/New_York',
            zoomMeetingId: `zoom_resolved_dispute_1`,
            zoomJoinUrl: `https://zoom.us/j/resolveddispute1`,
            candidateJoinedAt: new Date(baseDate.getTime() - 10 * 24 * 60 * 60 * 1000),
            professionalJoinedAt: new Date(baseDate.getTime() - 10 * 24 * 60 * 60 * 1000),
            attendanceOutcome: AttendanceOutcome.both_joined,
            refundCreatedAt: new Date(baseDate.getTime() - 7 * 24 * 60 * 60 * 1000),
            payment: {
                create: {
                    amountGross: 17500,
                    platformFee: 2625,
                    stripePaymentIntentId: generateStripeId('pi', 990),
                    status: PaymentStatus.refunded,
                    refundedAmountCents: 17500,
                    stripeRefundId: generateStripeId('re', 990),
                },
            },
            dispute: {
                create: {
                    initiatorId: candidateAt(8).id,
                    reason: DisputeReason.quality,
                    description: 'The professional was unprepared and the call quality was very poor.',
                    status: DisputeStatus.resolved,
                    resolution: 'Full refund issued to candidate after review.',
                    resolvedAt: new Date(baseDate.getTime() - 7 * 24 * 60 * 60 * 1000),
                    resolvedById: admin.id,
                },
            },
        },
    })
    console.log(`✅ Created resolved dispute with refund`)

    // 10. Reschedule pending booking (candidate-requested)
    const candidateRequestedRescheduleBooking = await prisma.booking.create({
        data: {
            candidateId: candidateAt(9).id,
            professionalId: professionalAt(9).id,
            status: BookingStatus.reschedule_pending,
            priceCents: 22500,
            startAt: new Date(baseDate.getTime() + 1 * 24 * 60 * 60 * 1000), // Original time tomorrow
            endAt: new Date(baseDate.getTime() + 1 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
            timezone: 'America/New_York',
            zoomMeetingId: `zoom_reschedule_1`,
            zoomJoinUrl: `https://zoom.us/j/reschedule1`,
            payment: {
                create: {
                    amountGross: 22500,
                    platformFee: 3375,
                    stripePaymentIntentId: generateStripeId('pi', 989),
                    status: PaymentStatus.held,
                },
            },
        },
    })
    await createCandidateRequestAvailability(candidateAt(9), new Date(baseDate.getTime() + 2 * 24 * 60 * 60 * 1000), true)
    console.log(`✅ Created candidate-requested reschedule pending booking`)

    // 11. Reschedule pending booking (professional-requested)
    const professionalRequestedRescheduleBooking = await prisma.booking.create({
        data: {
            candidateId: candidateAt(0).id,
            professionalId: professionalAt(2).id,
            status: BookingStatus.reschedule_pending,
            priceCents: 15000,
            startAt: new Date(baseDate.getTime() + 2 * 24 * 60 * 60 * 1000), // Original accepted time
            endAt: new Date(baseDate.getTime() + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
            timezone: candidateAt(0).timezone,
            zoomMeetingId: `zoom_reschedule_2`,
            zoomJoinUrl: `https://zoom.us/j/reschedule2`,
            payment: {
                create: {
                    amountGross: 15000,
                    platformFee: 2250,
                    stripePaymentIntentId: generateStripeId('pi', 988),
                    status: PaymentStatus.held,
                },
            },
        },
    })
    await createCandidateRequestAvailability(candidateAt(0), new Date(baseDate.getTime() + 3 * 24 * 60 * 60 * 1000), false)
    console.log(`✅ Created professional-requested reschedule pending booking`)

    console.log('')
    console.log('Creating exhaustive booking status matrix for all candidate/professional pairs...')
    for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex++) {
        const candidate = candidates[candidateIndex]
        for (let professionalIndex = 0; professionalIndex < professionals.length; professionalIndex++) {
            const professional = professionals[professionalIndex]
            const pairIndex = candidateIndex * professionals.length + professionalIndex

            for (let statusIndex = 0; statusIndex < ALL_BOOKING_STATUSES.length; statusIndex++) {
                const status = ALL_BOOKING_STATUSES[statusIndex]
                await createStatusMatrixBooking(candidate, professional, status, pairIndex, statusIndex)
                statusMatrixBookingCount++
            }
        }
        console.log(`📚 Created ${ALL_BOOKING_STATUSES.length * professionals.length} status-matrix bookings for ${candidate.email}`)
    }
    console.log(`✅ Created ${statusMatrixBookingCount} exhaustive status-matrix bookings`)

    // Create some audit log entries
    console.log('')
    console.log('Creating audit logs...')
    await prisma.auditLog.createMany({
        data: [
            {
                actorUserId: admin.id,
                entity: 'Dispute',
                entityId: resolvedDispute.id,
                action: 'dispute_resolved',
                metadata: JSON.stringify({ resolution: 'refund', amount: 17500 }),
            },
            {
                actorUserId: professionalAt(0).id,
                entity: 'Booking',
                entityId: completedBooking.id,
                action: 'feedback_submitted',
                metadata: JSON.stringify({ wordCount: 112, qcStatus: 'passed' }),
            },
            {
                actorUserId: candidateAt(0).id,
                entity: 'Booking',
                entityId: completedBooking.id,
                action: 'rating_submitted',
                metadata: JSON.stringify({ rating: 5 }),
            },
            {
                actorUserId: candidateAt(5).id,
                entity: 'Dispute',
                entityId: disputedBooking.id,
                action: 'dispute_opened',
                metadata: JSON.stringify({ reason: 'no_show' }),
            },
            {
                actorUserId: candidateAt(9).id,
                entity: 'Booking',
                entityId: candidateRequestedRescheduleBooking.id,
                action: 'booking_reschedule_requested',
                metadata: JSON.stringify({
                    previousStatus: 'accepted',
                    newStatus: 'reschedule_pending',
                    requestedByRole: 'CANDIDATE',
                    reason: 'Candidate requested a new slot after a final-round schedule conflict.',
                }),
            },
            {
                actorUserId: professionalAt(2).id,
                entity: 'Booking',
                entityId: professionalRequestedRescheduleBooking.id,
                action: 'booking_reschedule_requested',
                metadata: JSON.stringify({
                    previousStatus: 'accepted',
                    newStatus: 'reschedule_pending',
                    requestedByRole: 'PROFESSIONAL',
                    reason: 'Professional requested a new slot due to travel overlap.',
                }),
            },
        ],
    })
    console.log(`✅ Created audit log entries`)

    // Summary
    const seededCandidateEmails = candidates.map((candidate) => candidate.email).join(', ')
    const seededProfessionalEmails = professionals.map((professional) => professional.email).join(', ')

    console.log('')
    console.log('='.repeat(70))
    console.log('🎉 Seeding finished!')
    console.log('')
    console.log('📊 Summary:')
    console.log(`  Seed Mode: ${populationMode}`)
    console.log('  Users:')
    console.log(`    - 1 Admin: admin@monet.local (password: admin123!)`)
    console.log(`    - ${candidates.length} Candidates: ${seededCandidateEmails} (password: cand123!)`)
    console.log(`    - ${professionals.length} Professionals: ${seededProfessionalEmails} (password: pro123!)`)
    console.log('')
    console.log('  Per Professional (regular bookings):')
    console.log('    - 2 pending requests (status: requested)')
    console.log('    - 2 accepted bookings (status: accepted)')
    console.log('    - 2 calls pending feedback (status: completed_pending_feedback)')
    console.log('')
    console.log('  Edge Cases (11 additional bookings):')
    console.log('    - 1 completed with feedback + payout (QC passed)')
    console.log('    - 1 declined by professional')
    console.log('    - 1 expired (no response)')
    console.log('    - 1 cancelled with refund')
    console.log('    - 1 late cancellation (professional paid)')
    console.log('    - 1 open dispute (professional no-show)')
    console.log('    - 1 QC revise (feedback too short)')
    console.log('    - 1 candidate no-show')
    console.log('    - 1 resolved dispute with refund')
    console.log('    - 1 candidate-requested reschedule pending')
    console.log('    - 1 professional-requested reschedule pending')
    console.log('')
    console.log('  Exhaustive Status Matrix:')
    console.log(`    - ${candidates.length * professionals.length} candidate/professional pairs`)
    console.log(`    - ${ALL_BOOKING_STATUSES.length} statuses per pair`)
    console.log(`    - ${statusMatrixBookingCount} additional bookings`)
    console.log('')
    console.log(`  Total bookings created: ${bookingIndex + 11 + statusMatrixBookingCount}`)
    console.log('  Availability slots: 14 days for each candidate + request/reschedule candidate slots')
    console.log('  Audit log entries: 6')
    console.log('='.repeat(70))
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
