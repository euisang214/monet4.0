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

const prisma = new PrismaClient()

// Helper to generate unique IDs for Stripe mocks
const generateStripeId = (prefix: string, index: number) => `${prefix}_test_${index.toString().padStart(3, '0')}`

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

async function main() {
    console.log('Start seeding ...')
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

    // Create 10 Candidates with varied profiles
    const candidates: { id: string; email: string }[] = []
    for (let i = 1; i <= 10; i++) {
        const email = `cand${i}@monet.local`
        const school = SCHOOLS[(i - 1) % SCHOOLS.length]

        const candidate = await prisma.user.upsert({
            where: { email },
            update: {},
            create: {
                email,
                hashedPassword: candidatePassword,
                role: Role.CANDIDATE,
                timezone: ['America/New_York', 'America/Los_Angeles', 'America/Chicago', 'Europe/London', 'Asia/Tokyo'][i % 5],
                stripeCustomerId: generateStripeId('cus', i),
                candidateProfile: {
                    create: {
                        interests: INTERESTS[(i - 1) % INTERESTS.length],
                        resumeUrl: i <= 5 ? `https://storage.monet.local/resumes/candidate_${i}.pdf` : null,
                        education: {
                            create: {
                                school: school.name,
                                degree: school.degree,
                                fieldOfStudy: school.field,
                                startDate: new Date(`${2018 - i}-09-01`),
                                endDate: new Date(`${2022 - i}-05-15`),
                                gpa: 3.5 + (i % 5) * 0.1,
                                honors: i % 3 === 0 ? 'Summa Cum Laude' : i % 3 === 1 ? 'Magna Cum Laude' : null,
                                activities: ['Case Competition Club', 'Investment Club'],
                            },
                        },
                        experience: {
                            create: {
                                company: `Previous Company ${i}`,
                                title: 'Analyst',
                                startDate: new Date(`${2022 - i}-06-01`),
                                isCurrent: i % 3 === 0,
                                endDate: i % 3 === 0 ? null : new Date('2024-12-01'),
                                description: 'Analyzed business data and provided strategic recommendations.',
                                type: 'EXPERIENCE',
                            },
                        },
                    },
                },
            },
        })
        candidates.push({ id: candidate.id, email: candidate.email })
        console.log(`✅ Created candidate: ${candidate.email}`)
    }

    // Create 10 Professionals with Stripe account IDs and varied profiles
    const professionals: { id: string; email: string; stripeAccountId: string }[] = []
    for (let i = 1; i <= 10; i++) {
        const email = `pro${i}@monet.local`
        const stripeAccountId = generateStripeId('acct', i)
        const company = COMPANIES[(i - 1) % COMPANIES.length]
        const bio = BIOS[(i - 1) % BIOS.length]
        const school = SCHOOLS[(i + 4) % SCHOOLS.length] // Different schools than candidates

        const professional = await prisma.user.upsert({
            where: { email },
            update: {},
            create: {
                email,
                hashedPassword: professionalPassword,
                role: Role.PROFESSIONAL,
                timezone: ['America/New_York', 'America/Los_Angeles', 'America/Chicago', 'Europe/London', 'Asia/Singapore'][i % 5],
                stripeAccountId,
                googleCalendarConnected: i % 2 === 0, // Half have Google Calendar connected
                linkedinConnected: i % 3 !== 0, // Most have LinkedIn connected
                corporateEmailVerified: true,
                professionalProfile: {
                    create: {
                        employer: company.employer,
                        title: company.title,
                        bio,
                        priceCents: 10000 + (i * 2500), // $100 to $125 range
                        corporateEmail: `pro${i}@${company.employer.toLowerCase().replace(/\s+/g, '')}.local`,
                        verifiedAt: new Date(),
                        interests: INTERESTS[(i - 1) % INTERESTS.length],
                        availabilityPrefs: JSON.stringify({
                            weekdays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
                            preferredTimes: ['morning', 'afternoon'],
                            maxCallsPerWeek: 5 + i,
                        }),
                        education: {
                            create: {
                                school: school.name,
                                degree: school.degree,
                                fieldOfStudy: school.field,
                                startDate: new Date(`${2010 - i}-09-01`),
                                endDate: new Date(`${2014 - i}-05-15`),
                                gpa: 3.7 + (i % 3) * 0.1,
                                honors: i % 2 === 0 ? 'Dean\'s List' : null,
                                activities: ['Student Government', 'Debate Team'],
                            },
                        },
                        experience: {
                            create: [
                                {
                                    company: company.employer,
                                    title: company.title,
                                    startDate: new Date(`${2020 - (i % 3)}-01-01`),
                                    isCurrent: true,
                                    description: `Leading strategic initiatives and mentoring junior team members at ${company.employer}.`,
                                    type: 'EXPERIENCE',
                                    positionHistory: JSON.stringify([
                                        { title: 'Associate', startDate: '2018-01-01', endDate: '2020-01-01' },
                                    ]),
                                },
                                {
                                    company: COMPANIES[(i + 3) % COMPANIES.length].employer,
                                    title: 'Associate',
                                    startDate: new Date('2016-01-01'),
                                    endDate: new Date('2020-01-01'),
                                    isCurrent: false,
                                    description: 'Started career in a rotational program, building foundational skills.',
                                    type: 'EXPERIENCE',
                                },
                            ],
                        },
                    },
                },
            },
        })
        professionals.push({ id: professional.id, email: professional.email, stripeAccountId })
        console.log(`✅ Created professional: ${professional.email}`)
    }

    // Create availability slots for professionals
    console.log('')
    console.log('Creating availability slots...')
    const now = new Date()
    for (const professional of professionals) {
        // Create availability for next 14 days
        for (let day = 1; day <= 14; day++) {
            const date = new Date(now)
            date.setDate(date.getDate() + day)
            date.setHours(9, 0, 0, 0) // 9 AM

            // Skip weekends for some professionals
            const dayOfWeek = date.getDay()
            if (dayOfWeek === 0 || dayOfWeek === 6) continue

            // Create 3-4 one-hour slots per day
            for (let slot = 0; slot < (day % 2 === 0 ? 4 : 3); slot++) {
                const startTime = new Date(date)
                startTime.setHours(9 + slot * 2) // 9am, 11am, 1pm, 3pm

                const endTime = new Date(startTime)
                endTime.setHours(endTime.getHours() + 1)

                await prisma.availability.create({
                    data: {
                        userId: professional.id,
                        start: startTime,
                        end: endTime,
                        busy: false,
                        timezone: 'America/New_York',
                    },
                })
            }
        }
    }
    console.log(`✅ Created availability slots for all professionals`)

    // Create bookings for each professional
    console.log('')
    console.log('Creating bookings...')

    let bookingIndex = 0
    const baseDate = new Date()

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
                    timezone: 'America/New_York',
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
                    timezone: 'America/New_York',
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
                    timezone: 'America/New_York',
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

    // 1. Completed booking with feedback and payout (QC passed)
    const completedBooking = await prisma.booking.create({
        data: {
            candidateId: candidates[0].id,
            professionalId: professionals[0].id,
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
                    proStripeAccountId: professionals[0].stripeAccountId,
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
            candidateId: candidates[1].id,
            professionalId: professionals[1].id,
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
            candidateId: candidates[2].id,
            professionalId: professionals[2].id,
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
            candidateId: candidates[3].id,
            professionalId: professionals[3].id,
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
            candidateId: candidates[4].id,
            professionalId: professionals[4].id,
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
                    proStripeAccountId: professionals[4].stripeAccountId,
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
            candidateId: candidates[5].id,
            professionalId: professionals[5].id,
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
                    proStripeAccountId: professionals[5].stripeAccountId,
                    amountNet: 12750,
                    status: PayoutStatus.blocked,
                    reason: 'Dispute pending - professional no-show',
                },
            },
            dispute: {
                create: {
                    initiatorId: candidates[5].id,
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
            candidateId: candidates[6].id,
            professionalId: professionals[6].id,
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
            candidateId: candidates[7].id,
            professionalId: professionals[7].id,
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
                    proStripeAccountId: professionals[7].stripeAccountId,
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
            candidateId: candidates[8].id,
            professionalId: professionals[8].id,
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
                    initiatorId: candidates[8].id,
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

    // 10. Reschedule pending booking
    await prisma.booking.create({
        data: {
            candidateId: candidates[9].id,
            professionalId: professionals[9].id,
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
    console.log(`✅ Created reschedule pending booking`)

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
                actorUserId: professionals[0].id,
                entity: 'Booking',
                entityId: completedBooking.id,
                action: 'feedback_submitted',
                metadata: JSON.stringify({ wordCount: 112, qcStatus: 'passed' }),
            },
            {
                actorUserId: candidates[0].id,
                entity: 'Booking',
                entityId: completedBooking.id,
                action: 'rating_submitted',
                metadata: JSON.stringify({ rating: 5 }),
            },
            {
                actorUserId: candidates[5].id,
                entity: 'Dispute',
                entityId: disputedBooking.id,
                action: 'dispute_opened',
                metadata: JSON.stringify({ reason: 'no_show' }),
            },
        ],
    })
    console.log(`✅ Created audit log entries`)

    // Summary
    console.log('')
    console.log('='.repeat(70))
    console.log('🎉 Seeding finished!')
    console.log('')
    console.log('📊 Summary:')
    console.log('  Users:')
    console.log(`    - 1 Admin: admin@monet.local (password: admin123!)`)
    console.log(`    - 10 Candidates: cand1-10@monet.local (password: cand123!)`)
    console.log(`    - 10 Professionals: pro1-10@monet.local (password: pro123!)`)
    console.log('')
    console.log('  Per Professional (regular bookings):')
    console.log('    - 2 pending requests (status: requested)')
    console.log('    - 2 accepted bookings (status: accepted)')
    console.log('    - 2 calls pending feedback (status: completed_pending_feedback)')
    console.log('')
    console.log('  Edge Cases (10 additional bookings):')
    console.log('    - 1 completed with feedback + payout (QC passed)')
    console.log('    - 1 declined by professional')
    console.log('    - 1 expired (no response)')
    console.log('    - 1 cancelled with refund')
    console.log('    - 1 late cancellation (professional paid)')
    console.log('    - 1 open dispute (professional no-show)')
    console.log('    - 1 QC revise (feedback too short)')
    console.log('    - 1 candidate no-show')
    console.log('    - 1 resolved dispute with refund')
    console.log('    - 1 reschedule pending')
    console.log('')
    console.log(`  Total bookings created: ${bookingIndex + 10}`)
    console.log('  Availability slots: 14 days for each professional')
    console.log('  Audit log entries: 4')
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
