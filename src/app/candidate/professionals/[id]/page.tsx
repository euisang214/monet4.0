import React, { Suspense } from 'react';
import { auth } from '@/auth';
import { CandidateBrowse } from '@/lib/role/candidate/browse';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { EmptyState, PageHeader, SurfaceCard } from '@/components/ui';
import { appRoutes } from '@/lib/shared/routes';
import {
    formatProfessionalForCandidateView,
    formatRoleAtCompany,
} from '@/lib/domain/users/identity-labels';
import { formatProfessionalIndustry } from '@/lib/shared/professional-industries';
import { buttonVariants } from '@/components/ui/primitives/Button';
import styles from './page.module.css';

type DateLike = Date | string | null | undefined;
type TimelineItem = {
    startDate: DateLike;
    endDate?: DateLike;
    isCurrent?: boolean | null;
};

const monthYearFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: 'numeric',
});

const yearFormatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
});

function toValidDate(value: DateLike) {
    if (!value) return null;
    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function compareTimelineItems<T extends TimelineItem>(a: T, b: T) {
    const aCurrent = Boolean(a.isCurrent);
    const bCurrent = Boolean(b.isCurrent);

    if (aCurrent !== bCurrent) {
        return aCurrent ? -1 : 1;
    }

    const aStart = toValidDate(a.startDate)?.getTime() ?? 0;
    const bStart = toValidDate(b.startDate)?.getTime() ?? 0;

    return bStart - aStart;
}

function formatDateRange(item: TimelineItem, formatter: Intl.DateTimeFormat) {
    const startDate = toValidDate(item.startDate);
    const endDate = toValidDate(item.endDate);
    const startLabel = startDate ? formatter.format(startDate) : '';
    const endLabel = endDate ? formatter.format(endDate) : '';

    if (item.isCurrent) {
        return startLabel ? `${startLabel} - Present` : 'Present';
    }

    if (startLabel && endLabel) {
        return `${startLabel} - ${endLabel}`;
    }

    return startLabel || endLabel;
}

export default async function ProfessionalProfilePage(props: {
    params: Promise<{ id: string }>;
}) {
    const params = await props.params;
    const session = await auth();
    if (!session?.user) {
        redirect(`/login?callbackUrl=${appRoutes.candidate.professionalDetails(params.id)}`);
    }

    const profile = await CandidateBrowse.getProfessionalDetails(params.id, session.user.id);

    if (!profile) {
        notFound();
    }
    const professionalHeader = formatProfessionalForCandidateView({
        firstName: profile.user.firstName,
        lastName: profile.user.lastName,
        title: profile.title,
        company: profile.employer,
        revealName: !profile.isRedacted,
    });
    const roleLabel = formatRoleAtCompany(profile.title, profile.employer, 'Professional');
    const industryLabel = formatProfessionalIndustry(profile.industry);
    const experienceItems = [...(profile.experience || [])].sort(compareTimelineItems);
    const educationItems = [...(profile.education || [])].sort(compareTimelineItems);
    const activityItems = [...(profile.activities || [])].sort(compareTimelineItems);
    const hasBackgroundSections = experienceItems.length > 0 || educationItems.length > 0 || activityItems.length > 0;
    const formattedPrice = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((profile.priceCents || 0) / 100);

    return (
        <main className="space-y-6">
            <Link href={appRoutes.candidate.browse} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
                &larr; Back to Browse
            </Link>
            <PageHeader
                eyebrow="Professional profile"
                title={professionalHeader}
                description={industryLabel ? `${roleLabel} - ${industryLabel}` : roleLabel}
                meta={formattedPrice}
            />

            <div className={styles.profileLayout}>
                <div className="space-y-6">
                    <SurfaceCard tone="accent">
                        <section>
                            <h2 className="text-lg font-semibold text-gray-900 mb-3">About</h2>
                            <p className={`whitespace-pre-line text-gray-700 ${styles.aboutCopy}`}>
                                {profile.bio || 'No bio provided yet.'}
                            </p>
                        </section>
                    </SurfaceCard>

                    {hasBackgroundSections ? (
                        <SurfaceCard className="space-y-8">
                            {experienceItems.length > 0 ? (
                                <section>
                                    <h3 className="text-2xl font-bold text-gray-900 mb-4">Experience</h3>
                                    <div className="space-y-6">
                                        {experienceItems.map((experience) => (
                                            <article key={experience.id} className="border-l border-gray-900 p-2">
                                                <h4 className="font-semibold text-gray-900">{experience.title}</h4>
                                                <p className="text-gray-600 mt-1">{experience.company}</p>
                                                <p className="italic text-gray-500 mt-1">
                                                    {formatDateRange(experience, monthYearFormatter)}
                                                </p>
                                            </article>
                                        ))}
                                    </div>
                                </section>
                            ) : null}

                            {educationItems.length > 0 ? (
                                <section>
                                    <h3 className="text-2xl font-bold text-gray-900 mb-4">Education</h3>
                                    <div className="space-y-6">
                                        {educationItems.map((education) => {
                                            const educationTitle = [education.degree, education.fieldOfStudy]
                                                .filter(Boolean)
                                                .join(', ');
                                            return (
                                                <article key={education.id} className="border-l border-gray-900 p-2">
                                                    <h4 className="font-semibold text-gray-900">{educationTitle}</h4>
                                                    <p className="text-gray-600 mt-1">{education.school}</p>
                                                    <p className="italic text-gray-500 mt-1">
                                                        {formatDateRange(education, yearFormatter)}
                                                    </p>
                                                </article>
                                            );
                                        })}
                                    </div>
                                </section>
                            ) : null}

                            {activityItems.length > 0 ? (
                                <section>
                                    <h3 className="text-2xl font-bold text-gray-900 mb-4">Activities</h3>
                                    <div className="space-y-6">
                                        {activityItems.map((activity) => (
                                            <article key={activity.id} className="border-l border-gray-900 p-2">
                                                <h4 className="font-semibold text-gray-900">{activity.title}</h4>
                                                <p className="text-gray-600 mt-1">{activity.company}</p>
                                                <p className="italic text-gray-500 mt-1">
                                                    {formatDateRange(activity, monthYearFormatter)}
                                                </p>
                                            </article>
                                        ))}
                                    </div>
                                </section>
                            ) : null}
                        </SurfaceCard>
                    ) : null}

                    <SurfaceCard>
                        <Suspense fallback={<ProfessionalReviewsFallback />}>
                            <ProfessionalReviewsSection professionalId={params.id} />
                        </Suspense>
                    </SurfaceCard>
                </div>

                <SurfaceCard tone="muted" className={styles.sidebarCard}>
                    <div className="space-y-4">
                        <p className="text-xs uppercase tracking-wider text-blue-600">Next steps</p>
                        <h3 className="text-lg font-semibold">Ready to book?</h3>
                        <p className="text-gray-600 text-sm">
                            Schedule a consultation with {roleLabel} to discuss your career goals.
                        </p>

                        <Link
                            href={appRoutes.candidate.professionalBook(params.id)}
                            className={`${buttonVariants()} w-full justify-center`}
                        >
                            Book Now
                        </Link>

                        <p className="text-xs text-center text-gray-500 italic">
                            Secure payment via Stripe.
                        </p>
                    </div>
                </SurfaceCard>
            </div>
        </main>
    );
}

async function ProfessionalReviewsSection({ professionalId }: { professionalId: string }) {
    const reviews = await CandidateBrowse.getProfessionalReviews(professionalId);

    return (
        <section>
            <h3 className="text-xl font-bold text-gray-900 mb-5">Reviews ({reviews.length})</h3>
            {reviews.length === 0 ? (
                <EmptyState
                    badge="No reviews yet"
                    title="This professional has no submitted ratings"
                    description="Reviews appear here after completed consultations."
                    layout="inline"
                />
            ) : (
                <div className="space-y-6 mt-3">
                    {reviews.map((review) => (
                        <SurfaceCard key={review.bookingId} as="article" tone="muted">
                            <div className="flex items-start justify-between gap-4 mb-2">
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">
                                        {review.reviewerName || 'Anonymous Reviewer'}
                                    </p>
                                    <p className="text-gray-500 text-sm">
                                        {new Date(review.submittedAt).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className="flex text-yellow-400">
                                    {[...Array(5)].map((_, i) => (
                                        <span key={i}>{i < review.rating ? '★' : '☆'}</span>
                                    ))}
                                </div>
                            </div>
                            <p className="text-gray-700">{review.text}</p>
                        </SurfaceCard>
                    ))}
                </div>
            )}
        </section>
    );
}

function ProfessionalReviewsFallback() {
    return (
        <section>
            <h3 className="text-xl font-bold text-gray-900 mb-5">Reviews</h3>
            <p className="text-sm text-gray-500">Loading recent reviews...</p>
        </section>
    );
}
