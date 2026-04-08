import React from "react";
import Link from "next/link";
import { requireRole } from "@/lib/core/api-helpers";
import { notFound, redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/core/db";
import { ProfessionalRescheduleService } from "@/lib/role/professional/reschedule";
import { appRoutes } from "@/lib/shared/routes";
import { formatCandidateForProfessionalView } from "@/lib/domain/users/identity-labels";
import { parseProposalSlots, proposalSlotsToIntervals } from "@/lib/domain/bookings/reschedule-proposals";
import { ProfessionalRescheduleWorkspace } from "./ProfessionalRescheduleWorkspace";

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
                select: { timezone: true, googleCalendarConnected: true },
            },
        },
    });

    if (!booking) notFound();
    if (booking.professionalId !== user.id) redirect(appRoutes.professional.requests);
    if (booking.status !== "reschedule_pending" && booking.status !== "accepted") {
        redirect(appRoutes.professional.requests);
    }

    const candidateLabel = formatCandidateForProfessionalView({
        firstName: booking.candidate.firstName,
        lastName: booking.candidate.lastName,
        experience: booking.candidate.candidateProfile?.experience,
        education: booking.candidate.candidateProfile?.education,
    });

    const slots = await ProfessionalRescheduleService.getRescheduleAvailability(id, user.id);
    const proposalSlots = proposalSlotsToIntervals(parseProposalSlots(booking.rescheduleProposalSlots));

    return (
        <main className="container py-8">
            <Link href={appRoutes.professional.requests} className="text-sm text-gray-500 hover:text-gray-900 mb-4 inline-block">
                &larr; Back to requests
            </Link>

            <header className="mb-6">
                <p className="text-xs uppercase tracking-wider text-blue-600 mb-2">Reschedule Request</p>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Select a new call time</h1>
                <p className="text-gray-600">
                    {booking.status === "accepted"
                        ? `Choose one of ${candidateLabel}'s currently available times or propose another set of slots.`
                        : booking.rescheduleAwaitingParty === "PROFESSIONAL"
                            ? `${candidateLabel} sent back a new set of times. Confirm one or reply with a replacement proposal round.`
                            : `Waiting for ${candidateLabel} to respond to the latest proposal round.`}
                </p>
            </header>

            <ProfessionalRescheduleWorkspace
                bookingId={id}
                bookingStatus={booking.status}
                candidateAvailabilitySlots={slots.map((slot) => ({
                    start: slot.start.toISOString(),
                    end: slot.end.toISOString(),
                }))}
                proposalSlots={proposalSlots}
                calendarTimezone={booking.timezone}
                professionalTimezone={booking.professional.timezone}
                isGoogleCalendarConnected={booking.professional.googleCalendarConnected}
                awaitingParty={booking.rescheduleAwaitingParty}
                previousStartAt={booking.startAt?.toISOString() ?? null}
                previousEndAt={booking.endAt?.toISOString() ?? null}
            />
        </main>
    );
}
