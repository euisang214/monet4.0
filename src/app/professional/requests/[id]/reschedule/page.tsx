import React from "react";
import Link from "next/link";
import { requireRole } from "@/lib/core/api-helpers";
import { notFound, redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/core/db";
import { ProfessionalRescheduleService } from "@/lib/role/professional/reschedule";
import { ConfirmRescheduleForm } from "@/components/bookings/ConfirmRescheduleForm";
import { appRoutes } from "@/lib/shared/routes";
import { formatCandidateForProfessionalView } from "@/lib/domain/users/identity-labels";

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function ProfessionalReschedulePage({ params }: PageProps) {
    const { id } = await params;
    const user = await requireRole(Role.PROFESSIONAL, appRoutes.professional.requestReschedule(id));

    const booking = await prisma.booking.findUnique({
        where: { id },
        include: {
            candidate: {
                select: {
                    firstName: true,
                    lastName: true,
                    candidateProfile: {
                        select: {
                            experience: {
                                where: { type: "EXPERIENCE" },
                                orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }, { id: "desc" }],
                                select: {
                                    id: true,
                                    title: true,
                                    company: true,
                                    startDate: true,
                                    endDate: true,
                                    isCurrent: true,
                                },
                            },
                            education: {
                                orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }, { id: "desc" }],
                                select: {
                                    id: true,
                                    school: true,
                                    startDate: true,
                                    endDate: true,
                                    isCurrent: true,
                                },
                            },
                        },
                    },
                },
            },
            professional: {
                select: { timezone: true },
            },
        },
    });

    if (!booking) notFound();
    if (booking.professionalId !== user.id) redirect(appRoutes.professional.requests);
    if (booking.status !== "reschedule_pending") {
        redirect(appRoutes.professional.requests);
    }

    const candidateLabel = formatCandidateForProfessionalView({
        firstName: booking.candidate.firstName,
        lastName: booking.candidate.lastName,
        experience: booking.candidate.candidateProfile?.experience,
        education: booking.candidate.candidateProfile?.education,
    });

    const slots = await ProfessionalRescheduleService.getRescheduleAvailability(id, user.id);

    return (
        <main className="container py-8">
            <Link href={appRoutes.professional.requests} className="text-sm text-gray-500 hover:text-gray-900 mb-4 inline-block">
                &larr; Back to requests
            </Link>

            <header className="mb-6">
                <p className="text-xs uppercase tracking-wider text-blue-600 mb-2">Reschedule Request</p>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Select a new call time</h1>
                <p className="text-gray-600">
                    Candidate {candidateLabel} requested a reschedule. Pick a new slot from their submitted availability.
                </p>
            </header>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <ConfirmRescheduleForm
                    bookingId={id}
                    slots={slots}
                    calendarTimezone={booking.timezone}
                    professionalTimezone={booking.professional.timezone}
                />
            </div>
        </main>
    );
}
