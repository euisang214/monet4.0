import React from "react";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/core/db";
import { ProfessionalRequestService } from "@/lib/role/professional/requests";
import { ConfirmBookingForm } from "@/components/bookings/ConfirmBookingForm";
import { Role } from "@prisma/client";
import Link from "next/link";

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function ConfirmAndSchedulePage({ params }: PageProps) {
    const session = await auth();
    const { id } = await params;

    if (!session || session.user.role !== Role.PROFESSIONAL) {
        redirect(`/login?callbackUrl=/professional/bookings/${id}/confirm-and-schedule`);
    }

    const booking = await prisma.booking.findUnique({
        where: { id },
        include: { candidate: true }
    });

    if (!booking) notFound();
    if (booking.professionalId !== session.user.id) redirect("/professional/dashboard");
    if (booking.status !== "requested") {
        redirect("/professional/dashboard");
    }

    const slots = await ProfessionalRequestService.getBookingCandidateAvailability(id, session.user.id);

    return (
        <main className="max-w-2xl mx-auto px-4 py-8">
            <Link href="/professional/requests" className="text-sm text-gray-500 hover:text-gray-900 mb-4 inline-block">
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
                <ConfirmBookingForm bookingId={id} slots={slots} />
            </div>
        </main>
    );
}
