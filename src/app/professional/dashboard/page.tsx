import React from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ProfessionalDashboardService } from "@/lib/role/professional/dashboard";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ProfessionalRequestCard } from "@/components/bookings/ProfessionalRequestCard";
import { FeedbackTaskCard } from "@/components/dashboard/FeedbackTaskCard";
import { Role } from "@prisma/client";

export default async function ProfessionalDashboardPage() {
    const session = await auth();

    if (!session || session.user.role !== Role.PROFESSIONAL) {
        redirect("/auth/signin");
    }

    const {
        totalEarningsCents,
        pendingPayoutsCents,
        pendingFeedbackCount,
        totalBookings,
        upcomingBookingsCount
    } = await ProfessionalDashboardService.getDashboardStats(session.user.id);

    const { actionRequired, pendingFeedback, upcoming } = await ProfessionalDashboardService.getDashboardBookings(session.user.id);

    const formatCurrency = (cents: number) =>
        new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Professional Dashboard</h1>
                <p className="mt-1 text-sm text-gray-500">Overview of your activity and earnings.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
                <StatsCard label="Total Earnings" value={formatCurrency(totalEarningsCents)} subValue="paid" />
                <StatsCard label="Pending Payouts" value={formatCurrency(pendingPayoutsCents)} />
                <StatsCard label="Upcoming Bookings" value={upcomingBookingsCount} />
                <StatsCard label="Pending Feedback" value={pendingFeedbackCount} />
            </div>

            {/* Action Required Section */}
            <div className="mb-8">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Action Required ({actionRequired.length + pendingFeedback.length})</h2>
                {actionRequired.length === 0 && pendingFeedback.length === 0 ? (
                    <p className="text-gray-500 text-sm">No pending requests.</p>
                ) : (
                    <div className="space-y-4">
                        {pendingFeedback.map(booking => (
                            <FeedbackTaskCard key={booking.id} booking={booking} />
                        ))}
                        {actionRequired.map(booking => (
                            <ProfessionalRequestCard key={booking.id} booking={booking as any} />
                        ))}
                    </div>
                )}
            </div>

            {/* Upcoming Section */}
            <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">Upcoming Bookings</h2>
                {upcoming.length === 0 ? (
                    <p className="text-gray-500 text-sm">No upcoming bookings.</p>
                ) : (
                    <div className="space-y-4">
                        {upcoming.map(booking => (
                            <div key={booking.id} className="p-4 bg-white rounded-lg border border-gray-200">
                                <h4 className="font-semibold">Booking with {booking.candidate.email}</h4>
                                <p className="text-sm text-gray-500">
                                    {booking.startAt ? booking.startAt.toLocaleDateString() : 'Date TBD'}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
