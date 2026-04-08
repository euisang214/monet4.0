import React, { Suspense } from "react";
import Link from "next/link";
import { requireRole } from "@/lib/core/api-helpers";
import { ProfessionalDashboardService, type ProfessionalDashboardView } from "@/lib/role/professional/dashboard";
import { ProfessionalRequestListItem } from "@/components/bookings/ProfessionalRequestListItem";
import { FeedbackTaskCard } from "@/components/dashboard/FeedbackTaskCard";
import { Role } from "@prisma/client";
import { DashboardSummaryStrip, EmptyState, PageHeader, SectionTabs, SurfaceCard } from "@/components/ui";
import { ProfessionalUpcomingCallsList } from "@/components/dashboard/ProfessionalUpcomingCallsList";
import { ProfessionalQcToastEmitter } from "@/components/dashboard/ProfessionalQcToastEmitter";
import { appRoutes } from "@/lib/shared/routes";
import { buttonVariants } from "@/components/ui/primitives/Button";
import styles from "./page.module.css";

const DASHBOARD_VIEWS: ProfessionalDashboardView[] = ["upcoming", "requested", "reschedule", "pending_feedback"];
const DEFAULT_VIEW: ProfessionalDashboardView = "upcoming";

const VIEW_META: Record<
    ProfessionalDashboardView,
    { title: string; description: string; emptyTitle: string; emptyDescription: string; summary: string }
> = {
    upcoming: {
        title: "Upcoming Calls",
        description: "Accepted calls currently scheduled on your calendar.",
        emptyTitle: "No upcoming calls",
        emptyDescription: "Accepted calls will appear here once they are on your schedule.",
        summary: "Scheduled now",
    },
    requested: {
        title: "Pending Requests",
        description: "New candidate requests waiting for your scheduling decision.",
        emptyTitle: "No pending requests",
        emptyDescription: "New candidate requests will appear here automatically.",
        summary: "Needs response",
    },
    reschedule: {
        title: "Reschedule Requests",
        description: "Requests that need an updated meeting time.",
        emptyTitle: "No reschedule requests",
        emptyDescription: "Reschedule requests will appear here when candidates request changes.",
        summary: "Time changes",
    },
    pending_feedback: {
        title: "Pending Feedback",
        description: "Completed calls waiting on feedback submission or revision.",
        emptyTitle: "No pending feedback",
        emptyDescription: "Feedback tasks appear here after completed sessions.",
        summary: "Close the loop",
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

async function ProfessionalDashboardInsights({ professionalId }: { professionalId: string }) {
    const [recentFeedbackData, recentQcEvents] = await Promise.all([
        ProfessionalDashboardService.getRecentFeedbackData(professionalId),
        ProfessionalDashboardService.getRecentQcEvents(professionalId),
    ]);
    const averageRating =
        typeof recentFeedbackData.stats.average === "number"
            ? Number(recentFeedbackData.stats.average).toFixed(1)
            : null;
    const qcToastEvents = recentQcEvents.map((event) => ({
        ...event,
        qcReviewedAt: event.qcReviewedAt.toISOString(),
    }));

    return (
        <>
            <ProfessionalQcToastEmitter events={qcToastEvents} />
            <section>
                <PageHeader
                    eyebrow="Recent feedback"
                    title="Rating summary"
                    description="A quick view of recent candidate sentiment."
                    meta={`${recentFeedbackData.stats.count} review${recentFeedbackData.stats.count === 1 ? "" : "s"}`}
                />
                <SurfaceCard tone="muted" className={styles.insightsSummary}>
                    <p className={styles.summaryLabel}>Rating summary</p>
                    <div className={styles.summaryValueRow}>
                        <span className={styles.summaryValue}>{averageRating ?? "No ratings"}</span>
                        <span className={styles.summaryMeta}>
                            {recentFeedbackData.stats.count} total review{recentFeedbackData.stats.count === 1 ? "" : "s"}
                        </span>
                    </div>
                </SurfaceCard>

                {recentFeedbackData.reviews.length === 0 ? (
                    <EmptyState
                        badge="No reviews yet"
                        title="No recent feedback"
                        description="Candidate reviews will appear here after completed calls are rated."
                        layout="inline"
                    />
                ) : (
                    <div className={styles.reviewList}>
                        {recentFeedbackData.reviews.map((review) => (
                            <SurfaceCard key={review.bookingId} as="article" tone="muted" className={styles.reviewCard}>
                                <div className={styles.reviewHeader}>
                                    <h4 className={styles.reviewName}>{review.candidateLabel || "Candidate"}</h4>
                                    <p className={styles.reviewMeta}>
                                        {review.submittedAt.toLocaleDateString()} · {review.rating}/5
                                    </p>
                                </div>
                                <p className={styles.reviewBody}>
                                    {review.text?.trim() ? review.text : "No written feedback provided."}
                                </p>
                            </SurfaceCard>
                        ))}
                    </div>
                )}
            </section>
        </>
    );
}

function ProfessionalDashboardInsightsFallback() {
    return (
        <section>
            <PageHeader
                eyebrow="Recent feedback"
                title="Rating summary"
                description="Loading recent candidate sentiment."
                className="mb-4"
            />
            <SurfaceCard>
                <p className="text-sm text-gray-500">Loading recent feedback...</p>
            </SurfaceCard>
        </section>
    );
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
        sectionCounts,
        items,
        nextCursor,
        professionalTimezone,
    } = await ProfessionalDashboardService.getDashboardData(user.id, {
        view: activeView,
        cursor: resolvedSearchParams.cursor,
    });

    const activeMeta = VIEW_META[activeView];
    const totalItemsInSection = sectionCounts[activeView];
    const upcomingItems = items as Parameters<typeof ProfessionalUpcomingCallsList>[0]["bookings"];
    const requestItems = items as Array<Parameters<typeof ProfessionalRequestListItem>[0]["booking"]>;
    const feedbackItems = items as Array<Parameters<typeof FeedbackTaskCard>[0]["booking"]>;
    const tabItems = DASHBOARD_VIEWS.map((view) => ({
        value: view,
        label: VIEW_META[view].title,
        href: sectionUrl(view),
        count: sectionCounts[view],
    }));
    const summaryItems = DASHBOARD_VIEWS.map((view) => ({
        key: view,
        label: VIEW_META[view].title,
        value: sectionCounts[view],
        subValue: VIEW_META[view].summary,
        href: sectionUrl(view),
    }));

    return (
        <div className={styles.page}>
            <PageHeader
                eyebrow="Professional dashboard"
                title="Upcoming calls, tasks, and candidate feedback"
                description="Stay on top of scheduled sessions, open tasks, and recent candidate ratings."
            />

            <DashboardSummaryStrip
                items={summaryItems}
                className={styles.summaryStrip}
                aria-label="Dashboard summary"
            />

            <section className={styles.queueSection}>
                <SurfaceCard tone="muted" className={styles.queuePanel}>
                    <SectionTabs items={tabItems} currentValue={activeView} aria-label="Dashboard sections" className={styles.tabs} />

                    <div className={styles.queueHeader}>
                        <div className={styles.queueCopy}>
                            <h2 className={styles.queueTitle}>{activeMeta.title}</h2>
                            <p className={styles.queueDescription}>{activeMeta.description}</p>
                        </div>
                        <span className={styles.queueCount}>{totalItemsInSection}</span>
                    </div>
                </SurfaceCard>

                {items.length === 0 ? (
                    <EmptyState
                        badge="Queue clear"
                        title={activeMeta.emptyTitle}
                        description={activeMeta.emptyDescription}
                        layout="inline"
                    />
                ) : null}

                {items.length > 0 && activeView === "upcoming" ? (
                    <ProfessionalUpcomingCallsList
                        bookings={upcomingItems}
                        professionalTimezone={professionalTimezone}
                    />
                ) : null}

                {items.length > 0 && (activeView === "requested" || activeView === "reschedule") ? (
                    <ul className={styles.queueList}>
                        {requestItems.map((booking) => (
                            <ProfessionalRequestListItem key={booking.id} booking={booking} />
                        ))}
                    </ul>
                ) : null}

                {items.length > 0 && activeView === "pending_feedback" ? (
                    <div className={styles.queueList}>
                        {feedbackItems.map((booking) => (
                            <FeedbackTaskCard key={booking.id} booking={booking} />
                        ))}
                    </div>
                ) : null}

                <div className={styles.pagination}>
                    {resolvedSearchParams.cursor ? (
                        <Link
                            href={sectionUrl(activeView)}
                            className={buttonVariants({ variant: "secondary" })}
                        >
                            Back to first page
                        </Link>
                    ) : null}

                    {nextCursor ? (
                        <Link
                            href={sectionUrl(activeView, nextCursor)}
                            className={buttonVariants({ variant: "secondary" })}
                        >
                            Older
                        </Link>
                    ) : null}
                </div>
            </section>

            <Suspense fallback={<ProfessionalDashboardInsightsFallback />}>
                <section className={styles.secondarySection}>
                    <ProfessionalDashboardInsights professionalId={user.id} />
                </section>
            </Suspense>
        </div>
    );
}
