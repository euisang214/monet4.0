import React, { Suspense } from 'react';
import Link from 'next/link';
import { auth } from '@/auth';
import { CandidateBrowse } from '@/lib/role/candidate/browse';
import { BrowseFilters } from '@/components/browse/BrowseFilters';
import { ListingCard } from '@/components/browse/ListingCard';
import { redirect } from 'next/navigation';
import { EmptyState, PageHeader } from '@/components/ui';
import { appRoutes } from '@/lib/shared/routes';
import { buttonVariants } from '@/components/ui/primitives/Button';
import {
    isProfessionalIndustry,
    type ProfessionalIndustryValue,
} from '@/lib/shared/professional-industries';
import {
    isProfessionalSeniority,
    type ProfessionalSeniorityValue,
} from '@/lib/shared/professional-seniority';
import styles from './page.module.css';

export const revalidate = 60;

type BrowseSearchParams = {
    cursor?: string;
    industry?: string;
    company?: string;
    seniority?: string;
};

function browsePageUrl(searchParams: BrowseSearchParams = {}) {
    const params = new URLSearchParams();

    if (searchParams.cursor) {
        params.set('cursor', searchParams.cursor);
    }
    if (searchParams.industry) {
        params.set('industry', searchParams.industry);
    }
    if (searchParams.company) {
        params.set('company', searchParams.company);
    }
    if (searchParams.seniority) {
        params.set('seniority', searchParams.seniority);
    }

    const queryString = params.toString();
    return queryString ? `${appRoutes.candidate.browse}?${queryString}` : appRoutes.candidate.browse;
}

async function BrowseFiltersSection({
    selectedIndustry,
    selectedCompany,
    selectedSeniority,
}: {
    selectedIndustry?: ProfessionalIndustryValue;
    selectedCompany?: string;
    selectedSeniority?: ProfessionalSeniorityValue;
}) {
    const filterOptions = await CandidateBrowse.getProfessionalFilterOptions();

    return (
        <BrowseFilters
            industries={filterOptions.industries}
            companies={filterOptions.companies}
            seniorities={filterOptions.seniorities}
            selectedIndustry={selectedIndustry}
            selectedCompany={selectedCompany}
            selectedSeniority={selectedSeniority}
        />
    );
}

function BrowseFiltersFallback({
    selectedIndustry,
    selectedCompany,
    selectedSeniority,
}: {
    selectedIndustry?: ProfessionalIndustryValue;
    selectedCompany?: string;
    selectedSeniority?: ProfessionalSeniorityValue;
}) {
    return (
        <BrowseFilters
            industries={[]}
            companies={[]}
            seniorities={[]}
            selectedIndustry={selectedIndustry}
            selectedCompany={selectedCompany}
            selectedSeniority={selectedSeniority}
        />
    );
}

export default async function BrowsePage({
    searchParams,
}: {
    searchParams?: Promise<BrowseSearchParams>;
}) {
    const session = await auth();
    if (!session?.user) {
        redirect('/login?callbackUrl=/candidate/browse');
    }

    const resolvedSearchParams = (await searchParams) ?? {};
    const industryParam = resolvedSearchParams.industry;
    const seniorityParam = resolvedSearchParams.seniority;
    const selectedIndustry: ProfessionalIndustryValue | undefined = industryParam && isProfessionalIndustry(industryParam)
        ? industryParam
        : undefined;
    const selectedCompany = resolvedSearchParams.company?.trim() || undefined;
    const selectedSeniority: ProfessionalSeniorityValue | undefined = seniorityParam && isProfessionalSeniority(seniorityParam)
        ? seniorityParam
        : undefined;
    const { items: professionals, nextCursor } = await CandidateBrowse.searchProfessionals({
        cursor: resolvedSearchParams.cursor,
        industry: selectedIndustry,
        company: selectedCompany,
        seniority: selectedSeniority,
    });
    const activeFilterCount = [selectedIndustry, selectedCompany, selectedSeniority].filter(Boolean).length;
    const activeFilterLabel = activeFilterCount > 0
        ? `${activeFilterCount} active filter${activeFilterCount === 1 ? '' : 's'}`
        : 'Showing all professionals';

    console.info('[perf][candidate-browse] pageData', {
        hasCursor: Boolean(resolvedSearchParams.cursor),
        industry: selectedIndustry ?? null,
        company: selectedCompany ?? null,
        seniority: selectedSeniority ?? null,
        rows: professionals.length,
    });

    return (
        <main className={styles.page}>
            <section className={styles.hero}>
                <PageHeader
                    eyebrow="Browse professionals"
                    title="Find the right professional for the conversation you need next"
                    description="Use industry, company, and seniority to narrow the field, then compare profiles built for structured 30-minute sessions."
                />

                <div className={styles.heroNotes}>
                    <div className={styles.heroNote}>
                        <span className={styles.heroNoteLabel}>What you’re seeing</span>
                        <span className={styles.heroNoteValue}>{professionals.length} professionals on this page</span>
                    </div>
                    <div className={styles.heroNote}>
                        <span className={styles.heroNoteLabel}>Decision lens</span>
                        <span className={styles.heroNoteValue}>Role, industry, seniority, and fit before you ever book</span>
                    </div>
                    <div className={styles.heroNote}>
                        <span className={styles.heroNoteLabel}>Workflow</span>
                        <span className={styles.heroNoteValue}>Request, confirm, and meet through one secure booking flow</span>
                    </div>
                </div>
            </section>

            {professionals.length === 0 ? (
                <div className={styles.content}>
                    <Suspense
                        fallback={
                            <BrowseFiltersFallback
                                selectedIndustry={selectedIndustry}
                                selectedCompany={selectedCompany}
                                selectedSeniority={selectedSeniority}
                            />
                        }
                    >
                        <BrowseFiltersSection
                            selectedIndustry={selectedIndustry}
                            selectedCompany={selectedCompany}
                            selectedSeniority={selectedSeniority}
                        />
                    </Suspense>
                    <EmptyState
                        badge="Directory unavailable"
                        title="No professionals are visible right now"
                        description="Profiles may be temporarily unavailable. Check back soon or review your account setup."
                        actionLabel="Go to chats"
                        actionHref={appRoutes.candidate.chats}
                        layout="inline"
                    />
                </div>
            ) : (
                <div className={styles.content}>
                    <Suspense
                        fallback={
                            <BrowseFiltersFallback
                                selectedIndustry={selectedIndustry}
                                selectedCompany={selectedCompany}
                                selectedSeniority={selectedSeniority}
                            />
                        }
                    >
                        <BrowseFiltersSection
                            selectedIndustry={selectedIndustry}
                            selectedCompany={selectedCompany}
                            selectedSeniority={selectedSeniority}
                        />
                    </Suspense>

                    <div className={styles.resultsBar}>
                        <p className={styles.resultsSummary}>Compare who feels most relevant before you commit time or money.</p>
                        <span className={styles.resultsMeta}>{activeFilterLabel}</span>
                    </div>

                    <div className={styles.resultsGrid}>
                        {professionals.map((pro) => (
                            <ListingCard key={pro.userId} professional={pro} />
                        ))}
                    </div>

                    <div className={styles.pagination}>
                        {resolvedSearchParams.cursor ? (
                            <Link
                                href={browsePageUrl({
                                    industry: selectedIndustry,
                                    company: selectedCompany,
                                    seniority: selectedSeniority,
                                })}
                                className={buttonVariants({ variant: 'secondary' })}
                            >
                                Back to first page
                            </Link>
                        ) : null}
                        {nextCursor ? (
                            <Link
                                href={browsePageUrl({
                                    cursor: nextCursor,
                                    industry: selectedIndustry,
                                    company: selectedCompany,
                                    seniority: selectedSeniority,
                                })}
                                className={buttonVariants({ variant: 'secondary' })}
                            >
                                Older
                            </Link>
                        ) : null}
                    </div>
                </div>
            )}
        </main>
    );
}
