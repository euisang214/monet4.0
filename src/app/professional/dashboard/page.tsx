import React from "react";
import Link from "next/link";
import { requireRole } from "@/lib/core/api-helpers";
import { ProfessionalDashboardService, type ProfessionalDashboardView } from "@/lib/role/professional/dashboard";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ProfessionalRequestListItem } from "@/components/bookings/ProfessionalRequestListItem";
import { FeedbackTaskCard } from "@/components/dashboard/FeedbackTaskCard";
import { Role } from "@prisma/client";
import { EmptyState } from "@/components/ui/composites/EmptyState";
import { ProfessionalUpcomingCallsList } from "@/components/dashboard/ProfessionalUpcomingCallsList";
import { appRoutes } from "@/lib/shared/routes";

const DASHBOARD_VIEWS: ProfessionalDashboardView[] = ["upcoming", "requested", "reschedule", "pending_feedback"];
const DEFAULT_VIEW: ProfessionalDashboardView = "upcoming";

const VIEW_META: Record<
    ProfessionalDashboardView,
    { title: string; description: string; emptyTitle: string; emptyDescription: string }
> = {
    upcoming: {
        title: "Upcoming Calls",
        description: "Accepted calls currently scheduled on your calendar.",
        emptyTitle: "No upcoming calls",
        emptyDescription: "Accepted calls will appear here once they are on your schedule.",
    },
    requested: {
        title: "Pending Requests",
        description: "New candidate requests waiting for your scheduling decision.",
        emptyTitle: "No pending requests",
        emptyDescription: "New candidate requests will appear here automatically.",
    },
    reschedule: {
        title: "Reschedule Requests",
        description: "Requests that need an updated meeting time.",
        emptyTitle: "No reschedule requests",
        emptyDescription: "Reschedule requests will appear here when candidates request changes.",
    },
    pending_feedback: {
        title: "Pending Feedback",
        description: "Completed calls waiting on feedback submission or revision.",
        emptyTitle: "No pending feedback",
        emptyDescription: "Feedback tasks appear here after completed sessions.",
    },
};

function isView(value: string | undefined): value is ProfessionalDashboardView {
    if (!value) return false;
    return DASHBOARD_VIEWS.includes(value as ProfessionalDashboardView);
}

function sectionUrl(view: ProfessionalDashboardView, cursor?: string) {
    const params = new URLSearchParams();
    params.set("view", view);
    if (cursor) {
        params.set("cursor", cursor);
    }
    return `${appRoutes.professional.dashboard}?${params.toString()}`;
}

export default async function ProfessionalDashboardPage({
    searchParams,
}: {
    searchParams?:
        | {
              view?: string;
              cursor?: string;
          }
        | Promise<{
              view?: string;
              cursor?: string;
          }>;
}) {
    const user = await requireRole(Role.PROFESSIONAL, appRoutes.professional.dashboard);
    const resolvedSearchParams = (await searchParams) ?? {};
    const activeView = isView(resolvedSearchParams.view) ? resolvedSearchParams.view : DEFAULT_VIEW;

    const {
        stats,
        sectionCounts,
        items,
        nextCursor,
        recentFeedback,
        reviewStats,
    } = await ProfessionalDashboardService.getDashboardData(user.id, {
        view: activeView,
        cursor: resolvedSearchParams.cursor,
    });

    const averageRating =
        typeof reviewStats.average === "number"
            ? Number(reviewStats.average).toFixed(1)
            : null;
    const activeMeta = VIEW_META[activeView];
    const totalItemsInSection = sectionCounts[activeView];
    const upcomingItems = items as Parameters<typeof ProfessionalUpcomingCallsList>[0]["bookings"];
    const requestItems = items as Array<Parameters<typeof ProfessionalRequestListItem>[0]["booking"]>;
    const feedbackItems = items as Array<Parameters<typeof FeedbackTaskCard>[0]["booking"]>;

    return (
        <div className="container py-8">
            <header className="mb-8">
                <p className="text-xs uppercase tracking-wider text-blue-600 mb-2">Professional Dashboard</p>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Upcoming calls, tasks, and candidate feedback</h1>
                <p className="text-gray-600">Stay on top of scheduled sessions, open tasks, and recent candidate ratings.</p>
            </header>

            <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
                <StatsCard label="Upcoming Bookings" value={stats.upcomingBookingsCount} />
                <StatsCard label="Pending Feedback" value={stats.pendingFeedbackCount} />
            </div>

            <section className="mb-8 space-y-4">
                <nav className="flex flex-wrap gap-2" aria-label="Dashboard sections">
                    {DASHBOARD_VIEWS.map((view) => {
                        const isActive = view === activeView;
                        const label = VIEW_META[view].title;
                        return (
                            <Link
                                key={view}
                                href={sectionUrl(view)}
                                className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${isActive
                                        ? "border-blue-600 bg-blue-600 text-white"
                                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                                    }`}
                            >
                                {label} ({sectionCounts[view]})
                            </Link>
                        );
                    })}
                </nav>

                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">{activeMeta.title}</h2>
                        <p className="text-sm text-gray-600 mt-1">{activeMeta.description}</p>
                    </div>
                    <span className="px-2 py-1 text-xs rounded-full font-semibold bg-gray-100 text-gray-700">
                        {totalItemsInSection}
                    </span>
                </div>

                {items.length === 0 ? (
                    <EmptyState
                        badge="Queue clear"
                        title={activeMeta.emptyTitle}
                        description={activeMeta.emptyDescription}
                    />
                ) : null}

                {items.length > 0 && activeView === "upcoming" ? (
                    <ProfessionalUpcomingCallsList bookings={upcomingItems} />
                ) : null}

                {items.length > 0 && (activeView === "requested" || activeView === "reschedule") ? (
                    <ul className="space-y-3">
                        {requestItems.map((booking) => (
                            <ProfessionalRequestListItem key={booking.id} booking={booking} />
                        ))}
                    </ul>
                ) : null}

                {items.length > 0 && activeView === "pending_feedback" ? (
                    <div className="space-y-3">
                        {feedbackItems.map((booking) => (
                            <FeedbackTaskCard key={booking.id} booking={booking} />
                        ))}
                    </div>
                ) : null}

                <div className="flex items-center gap-3">
                    {resolvedSearchParams.cursor ? (
                        <Link
                            href={sectionUrl(activeView)}
                            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                        >
                            Back to first page
                        </Link>
                    ) : null}

                    {nextCursor ? (
                        <Link
                            href={sectionUrl(activeView, nextCursor)}
                            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                        >
                            Older
                        </Link>
                    ) : null}
                </div>
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
                                    <h4 className="font-semibold text-gray-900">{review.candidateLabel || "Candidate"}</h4>
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
