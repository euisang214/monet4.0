import React from 'react';
import { requireRole } from '@/lib/core/api-helpers';
import { CandidateBrowse } from '@/lib/role/candidate/browse';
import { CandidateBookingRequestForm } from '@/components/bookings/CandidateBookingRequestForm';
import { notFound } from 'next/navigation';
import { Role } from '@prisma/client';
import { appRoutes } from '@/lib/shared/routes';

export default async function BookingRequestPage(props: {
    params: Promise<{ id: string }>;
}) {
    const params = await props.params;
    const user = await requireRole(Role.CANDIDATE, appRoutes.candidate.professionalBook(params.id));

    const professional = await CandidateBrowse.getProfessionalDetails(params.id);
    if (!professional) {
        notFound();
    }

    return (
        <div className="container mx-auto py-8 max-w-2xl">
            <h1 className="text-3xl font-bold mb-2">Request Booking</h1>
            <div className="mb-8 p-4 bg-white shadow rounded-lg">
                {/* User name isn't on User model in Prisma schema, so we use Title/Employer 
            which is consistent with anonymous browsing anyway. 
        */}
                <h2 className="text-xl font-semibold">{professional.title} at {professional.employer}</h2>
                <p className="text-lg font-medium mt-2">
                    Rate: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(professional.priceCents / 100)} / session
                </p>
            </div>

            <CandidateBookingRequestForm
                professionalId={params.id}
                priceCents={professional.priceCents}
                professionalTimezone={professional.timezone}
            />
        </div>
    );
}
