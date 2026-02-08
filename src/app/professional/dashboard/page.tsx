import React from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ProfessionalDashboardService } from "@/lib/role/professional/dashboard";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ProfessionalRequestCard } from "@/components/bookings/ProfessionalRequestCard";
import { FeedbackTaskCard } from "@/components/dashboard/FeedbackTaskCard";
import { Role } from "@prisma/client";
import { EmptyState } from "@/components/ui/composites/EmptyState";

export default async function ProfessionalDashboardPage() {
    const session = await auth();

    if (!session) {
        redirect("/login?callbackUrl=/professional/dashboard");
    }

    if (session.user.role !== Role.PROFESSIONAL) {
        redirect("/");
    }

    const {
        totalEarningsCents,
        pendingPayoutsCents,
        pendingFeedbackCount,
        upcomingBookingsCount,
    } = await ProfessionalDashboardService.getDashboardStats(session.user.id);

    const { actionRequired, pendingFeedback, upcoming } = await ProfessionalDashboardService.getDashboardBookings(session.user.id);

    const formatCurrency = (cents: number) =>
        new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <header className="mb-8">
                <p className="text-xs uppercase tracking-wider text-blue-600 mb-2">Professional Dashboard</p>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Action queue, bookings, and payouts</h1>
                <p className="text-gray-600">Track requests, submit pending feedback, and keep revenue visibility in one place.</p>
            </header>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
                <StatsCard label="Total Earnings" value={formatCurrency(totalEarningsCents)} subValue="paid" />
                <StatsCard label="Pending Payouts" value={formatCurrency(pendingPayoutsCents)} />
                <StatsCard label="Upcoming Bookings" value={upcomingBookingsCount} />
                <StatsCard label="Pending Feedback" value={pendingFeedbackCount} />
            </div>

            <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Action Required ({actionRequired.length + pendingFeedback.length})</h2>
                {actionRequired.length === 0 && pendingFeedback.length === 0 ? (
                    <EmptyState
                        badge="Queue clear"
                        title="No action required right now"
                        description="New booking requests and feedback tasks will appear here automatically."
                        actionLabel="Review earnings"
                        actionHref="/professional/earnings"
                    />
                ) : (
                    <div className="space-y-4">
                        {pendingFeedback.map(booking => (
                            <FeedbackTaskCard key={booking.id} booking={booking} />
                        ))}
                        {actionRequired.map(booking => (
                            <ProfessionalRequestCard key={booking.id} booking={booking} />
                        ))}
                    </div>
                )}
            </div>

            <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Upcoming Bookings</h2>
                {upcoming.length === 0 ? (
                    <EmptyState
                        badge="No scheduled sessions"
                        title="No upcoming bookings"
                        description="Accepted sessions with confirmed times will show up in this section."
                    />
                ) : (
                    <div className="space-y-4">
                        {upcoming.map(booking => (
                            <article key={booking.id} className="p-5 bg-white rounded-lg border border-gray-200 shadow-sm">
                                <h4 className="font-semibold text-gray-900 mb-1">Booking with {booking.candidate.email}</h4>
                                <p className="text-sm text-gray-500">
                                    {booking.startAt ? booking.startAt.toLocaleDateString() : 'Date TBD'}
                                </p>
                            </article>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
