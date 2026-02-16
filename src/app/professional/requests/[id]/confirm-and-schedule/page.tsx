import React from "react";
import { requireRole } from "@/lib/core/api-helpers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/core/db";
import { ProfessionalRequestService } from "@/lib/role/professional/requests";
import { ConfirmBookingForm } from "@/components/bookings/ConfirmBookingForm";
import { Role } from "@prisma/client";
import Link from "next/link";
import { appRoutes } from "@/lib/shared/routes";

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function ConfirmAndSchedulePage({ params }: PageProps) {
    const { id } = await params;
    const user = await requireRole(Role.PROFESSIONAL, appRoutes.professional.requestConfirmAndSchedule(id));

    const booking = await prisma.booking.findUnique({
        where: { id },
        include: { candidate: true, professional: true }
    });

    if (!booking) notFound();
    if (booking.professionalId !== user.id) redirect(appRoutes.professional.requests);
    if (booking.status !== "requested") {
        redirect(appRoutes.professional.requests);
    }

    const slots = await ProfessionalRequestService.getBookingCandidateAvailability(id, user.id);

    return (
        <main className="container py-8">
            <Link href={appRoutes.professional.requests} className="text-sm text-gray-500 hover:text-gray-900 mb-4 inline-block">
                &larr; Back to requests
            </Link>
            <header className="mb-6">
                <p className="text-xs uppercase tracking-wider text-blue-600 mb-2">Confirm Booking</p>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Schedule candidate request</h1>
                <p className="text-gray-600">
                    Request from {booking.candidate.email}. Choose a matching slot to finalize scheduling and payment capture.
                </p>
            </header>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <ConfirmBookingForm
                    bookingId={id}
                    slots={slots}
                    calendarTimezone={booking.candidate.timezone}
                    professionalTimezone={booking.professional.timezone}
                />
            </div>
        </main>
    );
}
