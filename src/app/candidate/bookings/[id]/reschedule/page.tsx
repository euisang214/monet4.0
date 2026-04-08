import { requireRole } from '@/lib/core/api-helpers';
import { prisma } from '@/lib/core/db';
import { Role } from '@prisma/client';
import { notFound } from 'next/navigation';
import { ReschedulePageClient } from './ReschedulePageClient';
import { CandidateAvailability } from '@/lib/role/candidate/availability';
import { parseProposalSlots, proposalSlotsToIntervals } from '@/lib/domain/bookings/reschedule-proposals';
import { normalizeTimezone } from '@/lib/utils/supported-timezones';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function ReschedulePage({ params }: PageProps) {
    const { id } = await params;
    const user = await requireRole(Role.CANDIDATE, `/candidate/bookings/${id}/reschedule`);

    const [booking, availabilitySeed] = await Promise.all([
        prisma.booking.findUnique({
            where: { id },
            select: {
                id: true,
                candidateId: true,
                status: true,
                startAt: true,
                endAt: true,
                rescheduleAwaitingParty: true,
                rescheduleProposalSource: true,
                rescheduleProposalSlots: true,
                professional: {
                    select: {
                        timezone: true,
                    },
                },
                candidate: {
                    select: {
                        googleCalendarConnected: true,
                        timezone: true,
                    },
                },
            },
        }),
        CandidateAvailability.getSavedAvailabilitySeed(user.id),
    ]);

    if (!booking || booking.candidateId !== user.id) {
        notFound();
    }

    return (
        <ReschedulePageClient
            bookingId={booking.id}
            bookingStatus={booking.status}
            calendarTimezone={availabilitySeed.candidateTimezone || normalizeTimezone(booking.candidate.timezone)}
            professionalTimezone={booking.professional.timezone}
            isGoogleCalendarConnected={availabilitySeed.isGoogleCalendarConnected ?? booking.candidate.googleCalendarConnected}
            initialAvailabilitySlots={availabilitySeed.initialAvailabilitySlots}
            awaitingParty={booking.rescheduleAwaitingParty}
            proposalSource={booking.rescheduleProposalSource}
            proposalSlots={proposalSlotsToIntervals(parseProposalSlots(booking.rescheduleProposalSlots))}
            previousStartAt={booking.startAt?.toISOString() ?? null}
            previousEndAt={booking.endAt?.toISOString() ?? null}
        />
    );
}
