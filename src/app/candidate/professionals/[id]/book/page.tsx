import React from 'react';
import { requireRole } from '@/lib/core/api-helpers';
import { CandidateBrowse } from '@/lib/role/candidate/browse';
import { CandidateAvailability } from '@/lib/role/candidate/availability';
import { CandidateBookingRequestForm } from '@/components/bookings/CandidateBookingRequestForm';
import { notFound } from 'next/navigation';
import { Role } from '@prisma/client';
import { appRoutes } from '@/lib/shared/routes';
import { formatProfessionalForCandidateView } from '@/lib/domain/users/identity-labels';

export default async function BookingRequestPage(props: {
    params: Promise<{ id: string }>;
}) {
    const params = await props.params;
    const user = await requireRole(Role.CANDIDATE, appRoutes.candidate.professionalBook(params.id));

    const [professional, availabilitySeed] = await Promise.all([
        CandidateBrowse.getProfessionalDetails(params.id, user.id),
        CandidateAvailability.getSavedAvailabilitySeed(user.id),
    ]);
    if (!professional) {
        notFound();
    }
    const professionalLabel = formatProfessionalForCandidateView({
        firstName: professional.user.firstName,
        lastName: professional.user.lastName,
        title: professional.title,
        company: professional.employer,
        revealName: !professional.isRedacted,
    });

    return (
        <div className="container mx-auto py-8 max-w-2xl">
            <h1 className="text-3xl font-bold mb-2">Request Booking</h1>
            <div className="mb-8 p-4 bg-white shadow rounded-lg">
                {/* Show role context here to stay consistent with browse/detail cards. */}
                <h2 className="text-xl font-semibold">{professionalLabel}</h2>
                <p className="text-lg font-medium mt-2">
                    Rate: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(professional.priceCents / 100)} / session
                </p>
            </div>

            <CandidateBookingRequestForm
                professionalId={params.id}
                priceCents={professional.priceCents}
                professionalTimezone={professional.timezone}
                candidateTimezone={availabilitySeed.candidateTimezone}
                initialAvailabilitySlots={availabilitySeed.initialAvailabilitySlots}
            />
        </div>
    );
}
