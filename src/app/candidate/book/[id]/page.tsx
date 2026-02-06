import React from 'react';
import { auth } from '@/auth';
import { CandidateBrowse } from '@/lib/role/candidate/browse';
import { BookingRequestForm } from './BookingRequestForm';
import { notFound, redirect } from 'next/navigation';
import { Role } from '@prisma/client';

export default async function BookingRequestPage(props: {
    params: Promise<{ id: string }>;
}) {
    const params = await props.params;
    const session = await auth();
    if (!session?.user) {
        redirect(`/auth/signin?callbackUrl=/candidate/book/${params.id}`);
    }

    if (session.user.role !== Role.CANDIDATE) {
        redirect('/');
    }

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

            <BookingRequestForm
                professionalId={params.id}
                priceCents={professional.priceCents}
            />
        </div>
    );
}
