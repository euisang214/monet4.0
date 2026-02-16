import { prisma } from '@/lib/core/db';
import { Role } from '@prisma/client';
import { mockZoom } from '../mocks/zoom';
import { createConnectedAccount } from '../helpers/stripe-live';

export type E2EActors = {
    candidateId: string;
    professionalId: string;
};

export function configureE2EMocks() {
    mockZoom.createZoomMeeting.mockResolvedValue({
        id: 123456789,
        join_url: 'https://zoom.us/j/123456789',
        start_url: 'https://zoom.us/s/123456789',
    });
}

export async function createE2EActors(): Promise<E2EActors> {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const connectedAccount = await createConnectedAccount();

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
            stripeAccountId: connectedAccount.id,
            professionalProfile: {
                create: {
                    employer: 'Test Corp',
                    title: 'Senior Tester',
                    bio: 'I test things',
                    priceCents: 10000,
                    corporateEmail: `pro-corp-${unique}@example.com`,
                },
            },
        },
    });

    return {
        candidateId: candidate.id,
        professionalId: professional.id,
    };
}

export async function cleanupE2EData(candidateId?: string, professionalId?: string) {
    if (!candidateId || !professionalId) return;

    const bookingIds = (
        await prisma.booking.findMany({
            where: {
                OR: [{ candidateId }, { professionalId }],
            },
            select: { id: true },
        })
    ).map((booking) => booking.id);

    if (bookingIds.length > 0) {
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

    await prisma.availability.deleteMany({ where: { userId: candidateId } });
    await prisma.experience.deleteMany({ where: { OR: [{ candidateId }, { professionalId }] } });
    await prisma.education.deleteMany({ where: { OR: [{ candidateId }, { professionalId }] } });
    await prisma.candidateProfile.deleteMany({ where: { userId: candidateId } });
    await prisma.professionalProfile.deleteMany({ where: { userId: professionalId } });
    await prisma.user.deleteMany({ where: { id: { in: [candidateId, professionalId] } } });
}
