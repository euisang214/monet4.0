import { auth } from '@/auth';
import { prisma } from '@/lib/core/db';
import { Role } from '@prisma/client';
import { notFound, redirect } from 'next/navigation';
import { ReschedulePageClient } from './ReschedulePageClient';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function ReschedulePage({ params }: PageProps) {
    const { id } = await params;
    const session = await auth();

    if (!session?.user) {
        redirect(`/login?callbackUrl=/candidate/bookings/${id}/reschedule`);
    }

    if (session.user.role !== Role.CANDIDATE) {
        redirect('/');
    }

    const booking = await prisma.booking.findUnique({
        where: { id },
        select: {
            id: true,
            candidateId: true,
            timezone: true,
            professional: {
                select: {
                    timezone: true,
                },
            },
        },
    });

    if (!booking || booking.candidateId !== session.user.id) {
        notFound();
    }

    return (
        <ReschedulePageClient
            bookingId={booking.id}
            calendarTimezone={booking.timezone}
            professionalTimezone={booking.professional.timezone}
        />
    );
}
