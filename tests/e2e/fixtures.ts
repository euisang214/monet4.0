import { prisma } from '@/lib/core/db';
import { Role } from '@prisma/client';
import { mockZoom } from '../mocks/zoom';
import { createConnectedAccount, confirmPaymentIntentForCapture } from '../helpers/stripe-live';
import { CandidateBookings } from '@/lib/role/candidate/bookings';
import { ProfessionalRequestService } from '@/lib/role/professional/requests';
import { completeIntegrations } from '@/lib/domain/bookings/transitions';
import { addDays, addMinutes } from 'date-fns';

export type E2EActors = {
    candidateId: string;
    professionalId: string;
};

export type RequestedBooking = {
    bookingId: string;
    paymentIntentId: string;
    proposedStartAt: Date;
    proposedEndAt: Date;
};

export type AcceptedBooking = RequestedBooking & {
    scheduledStartAt: Date;
    scheduledEndAt: Date;
};

export function configureE2EMocks() {
    mockZoom.createZoomMeeting.mockResolvedValue({
        id: 123456789,
        join_url: 'https://zoom.us/j/123456789',
        start_url: 'https://zoom.us/s/123456789',
    });
}

function randomToken(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

let cachedConnectedAccountId: string | null = null;

export async function createE2EActors(): Promise<E2EActors> {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    if (!cachedConnectedAccountId) {
        const connectedAccount = await createConnectedAccount();
        cachedConnectedAccountId = connectedAccount.id;
    }

    const candidate = await prisma.user.create({
        data: {
            email: `test-candidate-${unique}@example.com`,
            role: Role.CANDIDATE,
            candidateProfile: {
                create: {
                    interests: ['Testing'],
                },
            },
        },
    });

    const professional = await prisma.user.create({
        data: {
            email: `test-pro-${unique}@example.com`,
            role: Role.PROFESSIONAL,
            stripeAccountId: cachedConnectedAccountId,
            professionalProfile: {
                create: {
                    bio: 'I test things',
                    priceCents: 10000,
                    corporateEmail: `pro-corp-${unique}@example.com`,
                },
            },
        },
    });

    await prisma.experience.create({
        data: {
            professionalId: professional.id,
            company: 'Test Corp',
            title: 'Senior Tester',
            startDate: new Date('2020-01-01'),
            isCurrent: true,
            positionHistory: [],
            type: 'EXPERIENCE',
        },
    });

    return {
        candidateId: candidate.id,
        professionalId: professional.id,
    };
}

export async function createE2EAdmin(): Promise<string> {
    const unique = randomToken('admin');
    const admin = await prisma.user.create({
        data: {
            email: `test-admin-${unique}@example.com`,
            role: Role.ADMIN,
        },
    });
    return admin.id;
}

export async function requestBookingWithAuthorizedPayment(
    candidateId: string,
    professionalId: string,
    options: {
        dayOffset?: number;
        weeks?: number;
        timezone?: string;
    } = {}
): Promise<RequestedBooking> {
    const dayOffset = options.dayOffset ?? 2;
    const proposedStartAt = addDays(new Date(), dayOffset);
    proposedStartAt.setMinutes(0, 0, 0);
    const proposedEndAt = addMinutes(proposedStartAt, 30);

    const requestResult = await CandidateBookings.requestBooking(candidateId, {
        professionalId,
        weeks: options.weeks ?? 2,
        availabilitySlots: [{ start: proposedStartAt.toISOString(), end: proposedEndAt.toISOString() }],
        timezone: options.timezone ?? 'UTC',
    });
    await confirmPaymentIntentForCapture(requestResult.stripePaymentIntentId);

    return {
        bookingId: requestResult.booking.id,
        paymentIntentId: requestResult.stripePaymentIntentId,
        proposedStartAt,
        proposedEndAt,
    };
}

export async function createAcceptedBooking(
    candidateId: string,
    professionalId: string,
    options: {
        dayOffset?: number;
        scheduledStartAt?: Date;
        meetingId?: string;
    } = {}
): Promise<AcceptedBooking> {
    const requested = await requestBookingWithAuthorizedPayment(candidateId, professionalId, {
        dayOffset: options.dayOffset,
    });

    const scheduledStartAt = options.scheduledStartAt
        ? new Date(options.scheduledStartAt)
        : addDays(new Date(), options.dayOffset ?? 2);
    if (!options.scheduledStartAt) {
        scheduledStartAt.setMinutes(0, 0, 0);
    }
    const scheduledEndAt = addMinutes(scheduledStartAt, 30);

    await ProfessionalRequestService.confirmAndSchedule(
        requested.bookingId,
        professionalId,
        scheduledStartAt
    );

    const meetingId = options.meetingId ?? randomToken('meeting');
    await completeIntegrations(requested.bookingId, {
        joinUrl: `https://zoom.us/j/${meetingId}`,
        meetingId,
    });

    return {
        ...requested,
        scheduledStartAt,
        scheduledEndAt,
    };
}

export async function cleanupE2EData(
    candidateId?: string,
    professionalId?: string,
    extraUserIds: string[] = []
) {
    const participantIds = [candidateId, professionalId].filter((id): id is string => Boolean(id));
    const userIds = [...new Set([...participantIds, ...extraUserIds])];

    if (participantIds.length > 0) {
        const bookingIds = (
            await prisma.booking.findMany({
                where: {
                    OR: [
                        ...(candidateId ? [{ candidateId }] : []),
                        ...(professionalId ? [{ professionalId }] : []),
                    ],
                },
                select: { id: true },
            })
        ).map((booking) => booking.id);

        if (bookingIds.length > 0) {
            await prisma.zoomAttendanceEvent.deleteMany({
                where: { bookingId: { in: bookingIds } },
            });
            await prisma.professionalRating.deleteMany({
                where: { bookingId: { in: bookingIds } },
            });
            await prisma.dispute.deleteMany({
                where: { bookingId: { in: bookingIds } },
            });
            await prisma.callFeedback.deleteMany({
                where: { bookingId: { in: bookingIds } },
            });
            await prisma.payout.deleteMany({
                where: { bookingId: { in: bookingIds } },
            });
            await prisma.payment.deleteMany({
                where: { bookingId: { in: bookingIds } },
            });
            await prisma.booking.deleteMany({
                where: { id: { in: bookingIds } },
            });
        }
    }

    if (userIds.length > 0) {
        await prisma.auditLog.deleteMany({
            where: {
                actorUserId: { in: userIds },
            },
        });
    }

    if (candidateId) {
        await prisma.availability.deleteMany({ where: { userId: candidateId } });
        await prisma.candidateProfile.deleteMany({ where: { userId: candidateId } });
    }

    if (professionalId) {
        await prisma.professionalProfile.deleteMany({ where: { userId: professionalId } });
    }

    if (candidateId || professionalId) {
        await prisma.experience.deleteMany({
            where: {
                OR: [
                    ...(candidateId ? [{ candidateId }] : []),
                    ...(professionalId ? [{ professionalId }] : []),
                ],
            },
        });
        await prisma.education.deleteMany({
            where: {
                OR: [
                    ...(candidateId ? [{ candidateId }] : []),
                    ...(professionalId ? [{ professionalId }] : []),
                ],
            },
        });
    }

    if (userIds.length > 0) {
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
}
