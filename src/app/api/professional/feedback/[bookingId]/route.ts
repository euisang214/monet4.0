import { auth } from '@/auth';
import { ProfessionalFeedbackService } from '@/lib/role/professional/feedback';
import { Role } from '@prisma/client';
import { z } from 'zod';

const FeedbackSchema = z.object({
    text: z.string(),
    actions: z.array(z.string()).length(3),
    contentRating: z.number().min(1).max(5),
    deliveryRating: z.number().min(1).max(5),
    valueRating: z.number().min(1).max(5),
});

export async function POST(
    req: Request,
    { params }: { params: Promise<{ bookingId: string }> }
) {
    const { bookingId } = await params;
    const session = await auth();

    if (!session || session.user.role !== Role.PROFESSIONAL) {
        return Response.json({ error: 'unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const parsed = FeedbackSchema.safeParse(body);

        if (!parsed.success) {
            return Response.json({ error: 'validation_error', details: parsed.error }, { status: 400 });
        }

        await ProfessionalFeedbackService.submitFeedback(session.user.id, {
            bookingId,
            ...parsed.data
        });

        return Response.json({ success: true });
    } catch (error: any) {
        console.error('Submit feedback error:', error);
        return Response.json(
            { error: error.message || 'internal_error' },
            { status: error.message === 'Unauthorized' ? 403 : 500 }
        );
    }
}
