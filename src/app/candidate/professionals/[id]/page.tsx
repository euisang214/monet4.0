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
import { formatProfessionalSeniority } from '@/lib/shared/professional-seniority';
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
    const seniorityLabel = formatProfessionalSeniority(profile.seniority);
    const experienceItems = [...(profile.experience || [])].sort(compareTimelineItems);
    const educationItems = [...(profile.education || [])].sort(compareTimelineItems);
    const activityItems = [...(profile.activities || [])].sort(compareTimelineItems);
    const hasBackgroundSections = experienceItems.length > 0 || educationItems.length > 0 || activityItems.length > 0;
    const formattedPrice = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((profile.priceCents || 0) / 100);
    const profileTags = [
        profile.verifiedAt ? 'Verified professional' : null,
        industryLabel,
        seniorityLabel,
        profile.timezone || null,
    ].filter(Boolean);

    return (
        <main className={styles.page}>
            <Link href={appRoutes.candidate.browse} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
                &larr; Back to Browse
            </Link>

            <section className={styles.heroSection}>
                <div className={styles.heroCopy}>
                    <PageHeader
                        eyebrow="Professional profile"
                        title={professionalHeader}
                        description={industryLabel ? `${roleLabel} - ${industryLabel}` : roleLabel}
                        meta={formattedPrice}
                    />

                    {profileTags.length > 0 ? (
                        <div className={styles.tagRow}>
                            {profileTags.map((tag) => (
                                <span key={tag} className={styles.tag}>
                                    {tag}
                                </span>
                            ))}
                        </div>
                    ) : null}

                    <p className={styles.heroLead}>
                        Review current role context, background, and session details before deciding whether this is the right conversation for your next step.
                    </p>
                </div>

                <SurfaceCard tone="muted" className={styles.sidebarCard}>
                    <div className={styles.sidebarStack}>
                        <div className={styles.priceBlock}>
                            <span className={styles.priceLabel}>Session price</span>
                            <span className={styles.priceValue}>{formattedPrice}</span>
                        </div>

                        <p className={styles.sidebarDescription}>
                            Book a structured 30-minute session with {roleLabel} and move from profile review to a concrete request.
                        </p>

                        <div className={styles.sidebarList}>
                            <div className={styles.sidebarItem}>
                                <span className={styles.sidebarItemLabel}>Session format</span>
                                <span className={styles.sidebarItemValue}>30-minute guided conversation</span>
                            </div>
                            <div className={styles.sidebarItem}>
                                <span className={styles.sidebarItemLabel}>Booking flow</span>
                                <span className={styles.sidebarItemValue}>Request, confirm, and meet through Kafei</span>
                            </div>
                            <div className={styles.sidebarItem}>
                                <span className={styles.sidebarItemLabel}>Timezone</span>
                                <span className={styles.sidebarItemValue}>{profile.timezone || 'UTC'}</span>
                            </div>
                        </div>

                        <Link
                            href={appRoutes.candidate.professionalBook(params.id)}
                            className={`${buttonVariants()} w-full justify-center`}
                        >
                            Book Now
                        </Link>

                        <p className={styles.sidebarFootnote}>Secure payment via Stripe. Final scheduling happens after your request is submitted.</p>
                    </div>
                </SurfaceCard>
            </section>

            <div className={styles.profileLayout}>
                <div className={styles.mainColumn}>
                    <SurfaceCard tone="accent" className={styles.sectionCard}>
                        <section>
                            <div className={styles.sectionHeader}>
                                <p className={styles.sectionEyebrow}>About</p>
                                <h2 className={styles.sectionTitle}>What this professional brings to the conversation</h2>
                            </div>
                            <p className={`whitespace-pre-line ${styles.aboutCopy}`}>
                                {profile.bio || 'No bio provided yet.'}
                            </p>

                            {profile.interests?.length ? (
                                <div className={styles.interestsBlock}>
                                    <p className={styles.subtleLabel}>Topics and interests</p>
                                    <div className={styles.tagRow}>
                                        {profile.interests.map((interest) => (
                                            <span key={interest} className={styles.tag}>
                                                {interest}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                        </section>
                    </SurfaceCard>

                    {hasBackgroundSections ? (
                        <SurfaceCard className={styles.sectionCard}>
                            {experienceItems.length > 0 ? (
                                <section className={styles.timelineSection}>
                                    <div className={styles.sectionHeader}>
                                        <p className={styles.sectionEyebrow}>Experience</p>
                                        <h3 className={styles.sectionTitle}>Career path and recent roles</h3>
                                    </div>
                                    <div className={styles.timelineList}>
                                        {experienceItems.map((experience) => (
                                            <article key={experience.id} className={styles.timelineItem}>
                                                <h4 className={styles.timelineTitle}>{experience.title}</h4>
                                                <p className={styles.timelineMeta}>{experience.company}</p>
                                                <p className={styles.timelineDate}>
                                                    {formatDateRange(experience, monthYearFormatter)}
                                                </p>
                                            </article>
                                        ))}
                                    </div>
                                </section>
                            ) : null}

                            {educationItems.length > 0 ? (
                                <section className={styles.timelineSection}>
                                    <div className={styles.sectionHeader}>
                                        <p className={styles.sectionEyebrow}>Education</p>
                                        <h3 className={styles.sectionTitle}>Academic background</h3>
                                    </div>
                                    <div className={styles.timelineList}>
                                        {educationItems.map((education) => {
                                            const educationTitle = [education.degree, education.fieldOfStudy]
                                                .filter(Boolean)
                                                .join(', ');
                                            return (
                                                <article key={education.id} className={styles.timelineItem}>
                                                    <h4 className={styles.timelineTitle}>{educationTitle}</h4>
                                                    <p className={styles.timelineMeta}>{education.school}</p>
                                                    <p className={styles.timelineDate}>
                                                        {formatDateRange(education, yearFormatter)}
                                                    </p>
                                                </article>
                                            );
                                        })}
                                    </div>
                                </section>
                            ) : null}

                            {activityItems.length > 0 ? (
                                <section className={styles.timelineSection}>
                                    <div className={styles.sectionHeader}>
                                        <p className={styles.sectionEyebrow}>Activities</p>
                                        <h3 className={styles.sectionTitle}>Additional involvement</h3>
                                    </div>
                                    <div className={styles.timelineList}>
                                        {activityItems.map((activity) => (
                                            <article key={activity.id} className={styles.timelineItem}>
                                                <h4 className={styles.timelineTitle}>{activity.title}</h4>
                                                <p className={styles.timelineMeta}>{activity.company}</p>
                                                <p className={styles.timelineDate}>
                                                    {formatDateRange(activity, monthYearFormatter)}
                                                </p>
                                            </article>
                                        ))}
                                    </div>
                                </section>
                            ) : null}
                        </SurfaceCard>
                    ) : null}

                    <SurfaceCard className={styles.sectionCard}>
                        <Suspense fallback={<ProfessionalReviewsFallback />}>
                            <ProfessionalReviewsSection professionalId={params.id} />
                        </Suspense>
                    </SurfaceCard>
                </div>
            </div>
        </main>
    );
}

async function ProfessionalReviewsSection({ professionalId }: { professionalId: string }) {
    const reviews = await CandidateBrowse.getProfessionalReviews(professionalId);

    return (
        <section>
            <div className={styles.sectionHeader}>
                <p className={styles.sectionEyebrow}>Reviews</p>
                <h3 className={styles.sectionTitle}>Candidate feedback and completed-session ratings ({reviews.length})</h3>
            </div>
            {reviews.length === 0 ? (
                <EmptyState
                    badge="No reviews yet"
                    title="This professional has no submitted ratings"
                    description="Reviews appear here after completed consultations."
                    layout="inline"
                />
            ) : (
                <div className={styles.reviewList}>
                    {reviews.map((review) => (
                        <SurfaceCard key={review.bookingId} as="article" tone="muted" className={styles.reviewCard}>
                            <div className={styles.reviewHeader}>
                                <div>
                                    <p className={styles.reviewAuthor}>
                                        {review.reviewerName || 'Anonymous Reviewer'}
                                    </p>
                                    <p className={styles.reviewDate}>
                                        {new Date(review.submittedAt).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className={styles.reviewStars}>
                                    {[...Array(5)].map((_, i) => (
                                        <span key={i}>{i < review.rating ? '★' : '☆'}</span>
                                    ))}
                                </div>
                            </div>
                            <p className={styles.reviewText}>{review.text}</p>
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
            <div className={styles.sectionHeader}>
                <p className={styles.sectionEyebrow}>Reviews</p>
                <h3 className={styles.sectionTitle}>Candidate feedback and completed-session ratings</h3>
            </div>
            <p className={styles.reviewLoading}>Loading recent reviews...</p>
        </section>
    );
}
