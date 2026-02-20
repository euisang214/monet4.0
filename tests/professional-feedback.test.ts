import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProfessionalFeedbackService } from '@/lib/role/professional/feedback';
import { prisma } from '@/lib/core/db';
import { BookingStatus } from '@prisma/client';
import { qcQueue } from '@/lib/queues';

vi.mock('@/lib/core/db', () => ({
    prisma: {
        booking: { findUnique: vi.fn() },
        callFeedback: { upsert: vi.fn() },
    },
}));

vi.mock('@/lib/queues', () => ({
    qcQueue: { add: vi.fn() },
}));

describe('ProfessionalFeedbackService.submitFeedback', () => {
    const mockProfessionalId = 'prof_123';
    const mockBookingId = 'booking_abc';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should successfully submit feedback and enqueue QC job', async () => {
        vi.mocked(prisma.booking.findUnique).mockResolvedValue({
            professionalId: mockProfessionalId,
            status: BookingStatus.completed_pending_feedback,
        } as any);

        const data = {
            bookingId: mockBookingId,
            text: 'Great session, very insightful.',
            actions: ['Action 1', 'Action 2', 'Action 3'],
            contentRating: 5,
            deliveryRating: 4,
            valueRating: 5,
        };

        const result = await ProfessionalFeedbackService.submitFeedback(mockProfessionalId, data);

        expect(result).toEqual({ success: true });

        expect(prisma.callFeedback.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { bookingId: mockBookingId },
                create: expect.objectContaining({
                    qcStatus: 'missing',
                    text: data.text,
                    wordCount: 4,
                }),
                update: expect.objectContaining({
                    qcStatus: 'missing',
                    text: data.text,
                }),
            })
        );

        expect(qcQueue.add).toHaveBeenCalledWith('validate-feedback', { bookingId: mockBookingId });
    });

    it('should throw an error if booking is not found', async () => {
        vi.mocked(prisma.booking.findUnique).mockResolvedValue(null);

        const data = {
            bookingId: mockBookingId,
            text: 'Great session',
            actions: [],
            contentRating: 5,
            deliveryRating: 5,
            valueRating: 5,
        };

        await expect(ProfessionalFeedbackService.submitFeedback(mockProfessionalId, data))
            .rejects.toThrow('Booking not found');
    });

    it('should throw an error if the professional is unauthorized', async () => {
        vi.mocked(prisma.booking.findUnique).mockResolvedValue({
            professionalId: 'some_other_prof',
            status: BookingStatus.completed_pending_feedback,
        } as any);

        const data = {
            bookingId: mockBookingId,
            text: 'Great session',
            actions: [],
            contentRating: 5,
            deliveryRating: 5,
            valueRating: 5,
        };

        await expect(ProfessionalFeedbackService.submitFeedback(mockProfessionalId, data))
            .rejects.toThrow('Unauthorized');
    });

    it('should throw an error if the booking is not awaiting feedback', async () => {
        vi.mocked(prisma.booking.findUnique).mockResolvedValue({
            professionalId: mockProfessionalId,
            status: BookingStatus.completed,
        } as any);

        const data = {
            bookingId: mockBookingId,
            text: 'Great session',
            actions: [],
            contentRating: 5,
            deliveryRating: 5,
            valueRating: 5,
        };

        await expect(ProfessionalFeedbackService.submitFeedback(mockProfessionalId, data))
            .rejects.toThrow('Booking is not awaiting feedback');
    });
});
