import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBookingRequest } from '@/lib/domain/bookings/transitions';
import { BookingStatus, Role, PaymentStatus } from '@prisma/client';
import { addHours } from 'date-fns';

// Mocks
const mockPrisma = {
    user: {
        findUniqueOrThrow: vi.fn(),
    },
    professionalProfile: {
        findUniqueOrThrow: vi.fn(),
    },
    booking: {
        create: vi.fn(),
    },
    payment: {
        create: vi.fn(),
    },
    auditLog: {
        create: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback(mockPrisma)),
};

const mockStripe = {
    paymentIntents: {
        create: vi.fn(),
        update: vi.fn(),
    },
};

describe('Candidate Domain Logic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('createBookingRequest should create booking and payment intent', async () => {
        // Setup Mocks
        const candidateId = 'cand-123';
        const professionalId = 'pro-456';
        const weeks = 2;
        const priceCents = 10000;

        mockPrisma.user.findUniqueOrThrow.mockResolvedValue({ id: candidateId, role: Role.CANDIDATE, timezone: 'UTC' });
        mockPrisma.professionalProfile.findUniqueOrThrow.mockResolvedValue({ userId: professionalId, priceCents, user: { id: professionalId } });

        mockStripe.paymentIntents.create.mockResolvedValue({ id: 'pi_123', client_secret: 'secret_123' });
        mockPrisma.booking.create.mockResolvedValue({ id: 'book_123', status: BookingStatus.requested });
        mockPrisma.payment.create.mockResolvedValue({ id: 'pay_123', status: PaymentStatus.authorized });
        mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit_123' });

        // Execute
        const result = await createBookingRequest(candidateId, professionalId, weeks, { prisma: mockPrisma as any, stripe: mockStripe as any });

        // Verify
        expect(mockPrisma.user.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: candidateId } });
        expect(mockPrisma.professionalProfile.findUniqueOrThrow).toHaveBeenCalledWith({ where: { userId: professionalId }, include: { user: true } });

        expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(expect.objectContaining({
            amount: 10000,
            currency: 'usd',
            capture_method: 'manual',
            metadata: expect.objectContaining({ candidateId, professionalId })
        }));

        expect(mockPrisma.booking.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                candidateId,
                professionalId,
                status: BookingStatus.requested,
                priceCents: 10000,
            })
        }));

        expect(mockPrisma.payment.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                bookingId: 'book_123',
                amountGross: 10000,
                status: PaymentStatus.authorized,
                stripePaymentIntentId: 'pi_123'
            })
        }));

        expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                entity: 'Booking',
                entityId: 'book_123',
                action: 'booking_requested'
            })
        }));

        expect(result).toEqual({
            booking: { id: 'book_123', status: BookingStatus.requested },
            clientSecret: 'secret_123',
            stripePaymentIntentId: 'pi_123'
        });
    });
});
