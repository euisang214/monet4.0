import { prisma } from '@/lib/core/db';
import { getProfessionalProfile } from '@/lib/domain/users/service';
import { QCService } from '@/lib/domain/qc/services';

export const CandidateBrowse = {
    searchProfessionals: async () => {
        // @ts-ignore - Prisma view usage
        const listings = await prisma.listingCardView.findMany();
        return listings;
    },

    getProfessionalDetails: async (professionalId: string, viewerId?: string) => {
        return await getProfessionalProfile(professionalId, viewerId);
    },

    getProfessionalReviews: async (professionalId: string) => {
        return await QCService.getProfessionalReviews(professionalId);
    }
};
