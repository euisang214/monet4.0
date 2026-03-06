import { requireRole } from '@/lib/core/api-helpers';
import { prisma } from '@/lib/core/db';
import { Role } from '@prisma/client';
import { notFound } from 'next/navigation';
import { ReschedulePageClient } from './ReschedulePageClient';
import { normalizeTimezone } from '@/lib/utils/supported-timezones';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function ReschedulePage({ params }: PageProps) {
    const { id } = await params;
    const user = await requireRole(Role.CANDIDATE, `/candidate/bookings/${id}/reschedule`);

    const booking = await prisma.booking.findUnique({
        where: { id },
        select: {
            id: true,
            candidateId: true,
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
    });

    if (!booking || booking.candidateId !== user.id) {
        notFound();
    }

    return (
        <ReschedulePageClient
            bookingId={booking.id}
            calendarTimezone={normalizeTimezone(booking.candidate.timezone)}
            professionalTimezone={booking.professional.timezone}
            isGoogleCalendarConnected={booking.candidate.googleCalendarConnected}
        />
    );
}
