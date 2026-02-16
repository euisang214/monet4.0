import React from "react";
import { requireRole } from "@/lib/core/api-helpers";
import { ProfessionalDashboardService } from "@/lib/role/professional/dashboard";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ProfessionalRequestCard } from "@/components/bookings/ProfessionalRequestCard";
import { ProfessionalRequestListItem } from "@/components/bookings/ProfessionalRequestListItem";
import { FeedbackTaskCard } from "@/components/dashboard/FeedbackTaskCard";
import { BookingStatus, Role } from "@prisma/client";
import { EmptyState } from "@/components/ui/composites/EmptyState";
import { ProfessionalUpcomingCallsList } from "@/components/dashboard/ProfessionalUpcomingCallsList";

export default async function ProfessionalDashboardPage() {
    const user = await requireRole(Role.PROFESSIONAL, "/professional/dashboard");

    const {
        pendingFeedbackCount,
        upcomingBookingsCount,
    } = await ProfessionalDashboardService.getDashboardStats(user.id);

    const { actionRequired, pendingFeedback, upcoming, recentFeedback, reviewStats } =
        await ProfessionalDashboardService.getDashboardBookings(user.id);

    const requestedTasks = actionRequired.filter((booking) => booking.status === BookingStatus.requested);
    const rescheduleTasks = actionRequired.filter((booking) => booking.status === BookingStatus.reschedule_pending);
    const totalTaskCount = requestedTasks.length + rescheduleTasks.length + pendingFeedback.length;

    const averageRating =
        typeof reviewStats.average === "number"
            ? Number(reviewStats.average).toFixed(1)
            : null;

    return (
        <div className="container py-8">
            <header className="mb-8">
                <p className="text-xs uppercase tracking-wider text-blue-600 mb-2">Professional Dashboard</p>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Upcoming calls, tasks, and candidate feedback</h1>
                <p className="text-gray-600">Stay on top of scheduled sessions, open tasks, and recent candidate ratings.</p>
            </header>

            <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
                <StatsCard label="Upcoming Bookings" value={upcomingBookingsCount} />
                <StatsCard label="Pending Feedback" value={pendingFeedbackCount} />
            </div>

            <section className="mb-8">
                <h2 className="mb-4 text-xl font-semibold text-gray-900">Upcoming Calls</h2>
                {upcoming.length === 0 ? (
                    <EmptyState
                        badge="No scheduled sessions"
                        title="No upcoming calls"
                        description="Accepted calls will appear here once they are on your schedule."
                    />
                ) : (
                    <ProfessionalUpcomingCallsList bookings={upcoming} />
                )}
            </section>

            <section className="mb-8">
                <h2 className="mb-4 text-xl font-semibold text-gray-900">Tasks ({totalTaskCount})</h2>
                {totalTaskCount === 0 ? (
                    <EmptyState
                        badge="Queue clear"
                        title="No tasks right now"
                        description="New booking requests and feedback tasks will appear here automatically."
                    />
                ) : (
                    <div className="space-y-4">
                        {requestedTasks.length > 0 ? (
                            <section>
                                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                                    Pending Requests ({requestedTasks.length})
                                </h3>
                                <ul className="space-y-3">
                                    {requestedTasks.map((booking) => (
                                        <ProfessionalRequestListItem key={booking.id} booking={booking} />
                                    ))}
                                </ul>
                            </section>
                        ) : null}

                        {rescheduleTasks.length > 0 ? (
                            <section>
                                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                                    Reschedule Requests ({rescheduleTasks.length})
                                </h3>
                                <div className="space-y-3">
                                    {rescheduleTasks.map((booking) => (
                                        <ProfessionalRequestCard key={booking.id} booking={booking} />
                                    ))}
                                </div>
                            </section>
                        ) : null}

                        {pendingFeedback.length > 0 ? (
                            <section>
                                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                                    Pending Feedback ({pendingFeedback.length})
                                </h3>
                                <div className="space-y-3">
                                    {pendingFeedback.map((booking) => (
                                        <FeedbackTaskCard key={booking.id} booking={booking} />
                                    ))}
                                </div>
                            </section>
                        ) : null}
                    </div>
                )}
            </section>

            <section>
                <h2 className="mb-4 text-xl font-semibold text-gray-900">Recent Feedback</h2>
                <div className="mb-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Rating Summary</p>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-gray-900">{averageRating ?? "No ratings"}</span>
                        <span className="text-sm text-gray-600">
                            {reviewStats.count} total review{reviewStats.count === 1 ? "" : "s"}
                        </span>
                    </div>
                </div>

                {recentFeedback.length === 0 ? (
                    <EmptyState
                        badge="No reviews yet"
                        title="No recent feedback"
                        description="Candidate reviews will appear here after completed calls are rated."
                    />
                ) : (
                    <div className="space-y-4">
                        {recentFeedback.map((review) => (
                            <article key={review.bookingId} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                    <h4 className="font-semibold text-gray-900">{review.candidateEmail || "Candidate"}</h4>
                                    <p className="text-sm text-gray-500">
                                        {review.submittedAt.toLocaleDateString()} · {review.rating}/5
                                    </p>
                                </div>
                                <p className="mt-2 text-sm text-gray-700">
                                    {review.text?.trim() ? review.text : "No written feedback provided."}
                                </p>
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
