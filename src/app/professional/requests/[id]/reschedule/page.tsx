import React from "react";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/core/db";
import { ProfessionalRescheduleService } from "@/lib/role/professional/reschedule";
import { ConfirmRescheduleForm } from "@/components/bookings/ConfirmRescheduleForm";
import { appRoutes } from "@/lib/shared/routes";

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function ProfessionalReschedulePage({ params }: PageProps) {
    const session = await auth();
    const { id } = await params;

    if (!session || session.user.role !== Role.PROFESSIONAL) {
        redirect(`/login?callbackUrl=${appRoutes.professional.requestReschedule(id)}`);
    }

    const booking = await prisma.booking.findUnique({
        where: { id },
        include: { candidate: true, professional: true },
    });

    if (!booking) notFound();
    if (booking.professionalId !== session.user.id) redirect(appRoutes.professional.requests);
    if (booking.status !== "reschedule_pending") {
        redirect(appRoutes.professional.requests);
    }

    const slots = await ProfessionalRescheduleService.getRescheduleAvailability(id, session.user.id);

    return (
        <main className="container py-8">
            <Link href={appRoutes.professional.requests} className="text-sm text-gray-500 hover:text-gray-900 mb-4 inline-block">
                &larr; Back to requests
            </Link>

            <header className="mb-6">
                <p className="text-xs uppercase tracking-wider text-blue-600 mb-2">Reschedule Request</p>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Select a new call time</h1>
                <p className="text-gray-600">
                    Candidate {booking.candidate.email} requested a reschedule. Pick a new slot from their submitted availability.
                </p>
            </header>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <ConfirmRescheduleForm
                    bookingId={id}
                    slots={slots}
                    calendarTimezone={booking.candidate.timezone}
                    professionalTimezone={booking.professional.timezone}
                />
            </div>
        </main>
    );
}
