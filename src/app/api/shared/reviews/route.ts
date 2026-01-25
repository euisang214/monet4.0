import { auth } from '@/auth';
import { ReviewsService } from '@/lib/domain/reviews/service';
import { z } from 'zod';

const querySchema = z.object({
    professionalId: z.string().min(1),
});

/**
 * GET /api/shared/reviews
 * 
 * Get reviews for a professional with aggregated statistics.
 * Delegates to ReviewsService.getProfessionalReviews.
 */
export async function GET(request: Request) {
    const session = await auth();

    if (!session?.user) {
        return Response.json({ error: 'unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const professionalId = url.searchParams.get('professionalId');

    const result = querySchema.safeParse({ professionalId });
    if (!result.success) {
        return Response.json({ error: 'missing_professional_id' }, { status: 400 });
    }

    const { reviews, stats } = await ReviewsService.getProfessionalReviews(result.data.professionalId);

    return Response.json({ reviews, stats });
}
