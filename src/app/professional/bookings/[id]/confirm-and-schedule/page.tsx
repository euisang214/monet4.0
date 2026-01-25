import React from "react";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/core/db";
import { ProfessionalRequestService } from "@/lib/role/professional/requests";
import { ConfirmBookingForm } from "@/components/bookings/ConfirmBookingForm";
import { Role } from "@prisma/client";

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function ConfirmAndSchedulePage({ params }: PageProps) {
    const session = await auth();
    // Await params as per Next.js 15+ convention (though Next 14 allows sync access, declaring it async is safer for future)
    // Actually in Next 14 params are not promises, but if we use strict types we might just treat them as objects. 
    // However, clean access:
    const { id } = await params;

    if (!session || session.user.role !== Role.PROFESSIONAL) {
        redirect("/auth/signin");
    }

    const booking = await prisma.booking.findUnique({
        where: { id },
        include: { candidate: true }
    });

    if (!booking) notFound();
    if (booking.professionalId !== session.user.id) redirect("/professional/dashboard");
    if (booking.status !== "requested") {
        // If already accepted, redirect to details
        // redirect(`/professional/bookings/${id}`);
        // For now back to dashboard
        redirect("/professional/dashboard");
    }

    // Helper to get slots
    const slots = await ProfessionalRequestService.getBookingCandidateAvailability(id, session.user.id);

    return (
        <div className="max-w-2xl mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Confirm Booking</h1>
            <p className="text-gray-600 mb-8">
                Request from {booking.candidate.email}. Select a time to schedule and capture payment.
            </p>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <ConfirmBookingForm bookingId={id} slots={slots} />
            </div>
        </div>
    );
}
