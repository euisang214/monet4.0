import { describe, it, expect, vi, beforeEach } from 'vitest';

// Define mocks directly inside vi.mock factory to avoid hoisting issues with variables
vi.mock('@/lib/core/db', () => {
    const mockPrisma = {
        professionalRating: { findMany: vi.fn() },
        professionalProfile: { findUnique: vi.fn() },
        booking: { findFirst: vi.fn() },
        availability: { findMany: vi.fn(), create: vi.fn() },
        user: { findUnique: vi.fn() },
        experience: { findMany: vi.fn() },
        $transaction: vi.fn((callback) => {
            if (Array.isArray(callback)) {
                return Promise.all(callback);
            }
            return callback(mockPrisma);
        }),
    };
    return { prisma: mockPrisma };
});

vi.mock('@/lib/integrations/calendar/google', () => ({
    getGoogleBusyTimes: vi.fn().mockResolvedValue([{ start: new Date('2023-01-01'), end: new Date('2023-01-02') }]),
    getGoogleOAuthClient: vi.fn()
}));

// Import AFTER mocking is set up (though vitest handles imports, hoisting rules apply to the mock factory content)
import { CandidateAvailability } from '@/lib/role/candidate/availability';
import { CandidateBrowse } from '@/lib/role/candidate/browse';
import { prisma } from '@/lib/core/db'; // Import the mocked prisma to assert on it

describe('Pre-Booking Domain Logic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('CandidateBrowse', () => {
        it('getProfessionalReviews should fetch reviews', async () => {
            // @ts-ignore
            prisma.professionalRating.findMany.mockResolvedValue([{ rating: 5, text: 'Great' }]);

            const reviews = await CandidateBrowse.getProfessionalReviews('pro-1');

            expect(prisma.professionalRating.findMany).toHaveBeenCalledWith(expect.objectContaining({
                where: { booking: { professionalId: 'pro-1' } }
            }));
            expect(reviews).toHaveLength(1);
        });

        it('getProfessionalDetails should fetch profile with redaction if no booking', async () => {
            // @ts-ignore
            prisma.professionalProfile.findUnique.mockResolvedValue({ userId: 'pro-1', user: { email: 'real@email.com' } });
            // @ts-ignore
            prisma.experience.findMany.mockResolvedValue([]);
            // @ts-ignore
            prisma.booking.findFirst.mockResolvedValue(null); // No booking

            const profile = await CandidateBrowse.getProfessionalDetails('pro-1', 'viewer-1');

            if (!profile) throw new Error("Profile not found");
            expect(profile.user.email).toBe('REDACTED');
            expect(profile.isRedacted).toBe(true);
        });

        it('getProfessionalDetails should reveal identity if booking exists', async () => {
            // @ts-ignore
            prisma.professionalProfile.findUnique.mockResolvedValue({ userId: 'pro-1', user: { email: 'real@email.com' } });
            // @ts-ignore
            prisma.experience.findMany.mockResolvedValue([]);
            // @ts-ignore
            prisma.booking.findFirst.mockResolvedValue({ id: 'b1' }); // Booking exists

            const profile = await CandidateBrowse.getProfessionalDetails('pro-1', 'viewer-1');

            if (!profile) throw new Error("Profile not found");
            expect(profile.user.email).toBe('real@email.com');
            expect(profile.isRedacted).toBe(false);
        });
    });

    describe('CandidateAvailability', () => {
        it('getBusyTimes should merge google and db busy times', async () => {
            // @ts-ignore
            prisma.availability.findMany.mockResolvedValue([{ start: new Date('2023-01-03'), end: new Date('2023-01-04') }]);

            const busy = await CandidateAvailability.getBusyTimes('cand-1');

            expect(busy).toHaveLength(2);
        });

        it('setAvailability should create availability slots', async () => {
            const slots = [{ start: new Date(), end: new Date(), busy: true }];
            // @ts-ignore
            prisma.user.findUnique.mockResolvedValue({ timezone: 'UTC' });
            // @ts-ignore
            prisma.availability.create.mockResolvedValue({});

            await CandidateAvailability.setAvailability('cand-1', slots);

            expect(prisma.$transaction).toHaveBeenCalled();
        });
    });
});
