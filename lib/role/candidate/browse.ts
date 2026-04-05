import { prisma } from '@/lib/core/db';
import { getProfessionalProfile } from '@/lib/domain/users/service';
import { QCService } from '@/lib/domain/qc/services';
import { Prisma } from '@prisma/client';
import { unstable_cache } from 'next/cache';
import {
    PROFESSIONAL_SENIORITY_LABELS,
    type ProfessionalSeniorityValue,
} from '@/lib/shared/professional-seniority';
import {
    PROFESSIONAL_INDUSTRY_LABELS,
    type ProfessionalIndustryValue,
} from '@/lib/shared/professional-industries';

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 50;

export type ListingCardRow = {
    userId: string;
    title: string;
    employer: string;
    industry?: string | null;
    seniority?: string | null;
    priceCents: number;
    bio: string;
};

type SearchProfessionalsOptions = {
    take?: number;
    cursor?: string;
    industry?: ProfessionalIndustryValue;
    company?: string;
    seniority?: ProfessionalSeniorityValue;
};

export type ProfessionalFilterOption<TValue extends string> = {
    value: TValue;
    label: string;
};

function getPageSize(take: number | undefined) {
    if (typeof take !== 'number' || Number.isNaN(take)) {
        return DEFAULT_PAGE_SIZE;
    }

    return Math.min(Math.max(Math.floor(take), 1), MAX_PAGE_SIZE);
}

function isInvalidCursorError(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

function isMissingIncrementalCacheError(error: unknown) {
    return error instanceof Error && error.message.includes('incrementalCache missing');
}

async function runSearchProfessionals(options: SearchProfessionalsOptions = {}) {
    const take = getPageSize(options.take);
    const startedAt = performance.now();
    const company = options.company?.trim();
    const where = {
        ...(options.industry ? { industry: options.industry } : {}),
        ...(company ? { employer: company } : {}),
        ...(options.seniority ? { seniority: options.seniority } : {}),
    };
    const buildQuery = (cursor?: string) => ({
        where,
        orderBy: { userId: 'asc' as const },
        take: take + 1,
        ...(cursor ? { cursor: { userId: cursor }, skip: 1 } : {}),
    });
    let listings: ListingCardRow[];

    try {
        // @ts-ignore - Prisma view usage
        listings = await prisma.listingCardView.findMany(buildQuery(options.cursor));
    } catch (error) {
        if (options.cursor && isInvalidCursorError(error)) {
            // Fallback to first page when cursor is stale/invalid.
            // @ts-ignore - Prisma view usage
            listings = await prisma.listingCardView.findMany(buildQuery());
        } else {
            throw error;
        }
    }

    const hasMore = listings.length > take;
    const items = hasMore ? listings.slice(0, take) : listings;
    const nextCursor = hasMore ? items[items.length - 1]?.userId : undefined;
    const durationMs = Number((performance.now() - startedAt).toFixed(2));

    console.info('[perf][candidate-browse] searchProfessionals', {
        take,
        hasCursor: Boolean(options.cursor),
        industry: options.industry ?? null,
        company: company ?? null,
        seniority: options.seniority ?? null,
        rows: items.length,
        hasMore,
        durationMs,
    });

    return {
        items: items as ListingCardRow[],
        nextCursor,
    };
}

const getCachedSearchProfessionals = unstable_cache(
    async (
        cursor: string | undefined,
        industry: ProfessionalIndustryValue | undefined,
        company: string | undefined,
        seniority: ProfessionalSeniorityValue | undefined,
        take: number,
    ) => {
        return runSearchProfessionals({
            cursor,
            industry,
            company,
            seniority,
            take,
        });
    },
    ['candidate-browse-search'],
    { revalidate: 30 },
);

const getCachedProfessionalFilterOptions = unstable_cache(
    async () => {
        const [industryRows, companyRows, seniorityRows] = await Promise.all([
            // @ts-ignore - Prisma view usage
            prisma.listingCardView.findMany({
                where: { industry: { not: null } },
                select: { industry: true },
                distinct: ['industry'],
            }),
            // @ts-ignore - Prisma view usage
            prisma.listingCardView.findMany({
                select: { employer: true },
                distinct: ['employer'],
            }),
            // @ts-ignore - Prisma view usage
            prisma.listingCardView.findMany({
                where: { seniority: { not: null } },
                select: { seniority: true },
                distinct: ['seniority'],
            }),
        ]);

        const industries = industryRows
            .flatMap((row) => (row.industry ? [{
                value: row.industry,
                label: PROFESSIONAL_INDUSTRY_LABELS[row.industry],
            }] : []))
            .sort((left, right) => left.label.localeCompare(right.label));

        const companies = companyRows
            .flatMap((row) => {
                const employer = row.employer?.trim();
                return employer ? [{ value: employer, label: employer }] : [];
            })
            .sort((left, right) => left.label.localeCompare(right.label));

        const seniorities = seniorityRows
            .flatMap((row) => (row.seniority ? [{
                value: row.seniority,
                label: PROFESSIONAL_SENIORITY_LABELS[row.seniority],
            }] : []))
            .sort((left, right) => left.label.localeCompare(right.label));

        return {
            industries,
            companies,
            seniorities,
        };
    },
    ['candidate-browse-filter-options'],
    { revalidate: 300 },
);

export const CandidateBrowse = {
    searchProfessionals: async (options: SearchProfessionalsOptions = {}) => {
        const take = getPageSize(options.take);
        const company = options.company?.trim();

        try {
            return await getCachedSearchProfessionals(
                options.cursor,
                options.industry,
                company,
                options.seniority,
                take,
            );
        } catch (error) {
            if (isMissingIncrementalCacheError(error)) {
                return runSearchProfessionals({
                    cursor: options.cursor,
                    industry: options.industry,
                    company,
                    seniority: options.seniority,
                    take,
                });
            }

            throw error;
        }
    },

    getProfessionalFilterOptions: async () => {
        try {
            return await getCachedProfessionalFilterOptions();
        } catch (error) {
            if (isMissingIncrementalCacheError(error)) {
                const [industryRows, companyRows, seniorityRows] = await Promise.all([
                    // @ts-ignore - Prisma view usage
                    prisma.listingCardView.findMany({
                        where: { industry: { not: null } },
                        select: { industry: true },
                        distinct: ['industry'],
                    }),
                    // @ts-ignore - Prisma view usage
                    prisma.listingCardView.findMany({
                        select: { employer: true },
                        distinct: ['employer'],
                    }),
                    // @ts-ignore - Prisma view usage
                    prisma.listingCardView.findMany({
                        where: { seniority: { not: null } },
                        select: { seniority: true },
                        distinct: ['seniority'],
                    }),
                ]);

                return {
                    industries: industryRows
                        .flatMap((row) => (row.industry ? [{
                            value: row.industry,
                            label: PROFESSIONAL_INDUSTRY_LABELS[row.industry],
                        }] : []))
                        .sort((left, right) => left.label.localeCompare(right.label)),
                    companies: companyRows
                        .flatMap((row) => {
                            const employer = row.employer?.trim();
                            return employer ? [{ value: employer, label: employer }] : [];
                        })
                        .sort((left, right) => left.label.localeCompare(right.label)),
                    seniorities: seniorityRows
                        .flatMap((row) => (row.seniority ? [{
                            value: row.seniority,
                            label: PROFESSIONAL_SENIORITY_LABELS[row.seniority],
                        }] : []))
                        .sort((left, right) => left.label.localeCompare(right.label)),
                };
            }

            throw error;
        }
    },

    getProfessionalDetails: async (professionalId: string, viewerId?: string) => {
        return await getProfessionalProfile(professionalId, viewerId);
    },

    getProfessionalReviews: async (professionalId: string) => {
        return await QCService.getProfessionalReviews(professionalId);
    }
};
