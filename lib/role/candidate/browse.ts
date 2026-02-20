import { prisma } from '@/lib/core/db';
import { getProfessionalProfile } from '@/lib/domain/users/service';
import { QCService } from '@/lib/domain/qc/services';
import { Prisma } from '@prisma/client';

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 50;

export type ListingCardRow = {
    userId: string;
    title: string;
    employer: string;
    priceCents: number;
    bio: string;
};

type SearchProfessionalsOptions = {
    take?: number;
    cursor?: string;
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

export const CandidateBrowse = {
    searchProfessionals: async (options: SearchProfessionalsOptions = {}) => {
        const take = getPageSize(options.take);
        const startedAt = performance.now();
        const buildQuery = (cursor?: string) => ({
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
            rows: items.length,
            hasMore,
            durationMs,
        });

        return {
            items: items as ListingCardRow[],
            nextCursor,
        };
    },

    getProfessionalDetails: async (professionalId: string, viewerId?: string) => {
        return await getProfessionalProfile(professionalId, viewerId);
    },

    getProfessionalReviews: async (professionalId: string) => {
        return await QCService.getProfessionalReviews(professionalId);
    }
};
