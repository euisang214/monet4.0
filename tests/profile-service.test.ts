import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Role } from '@prisma/client';

// Use vi.hoisted to ensure mocks are created before module loading
const mockPrisma = vi.hoisted(() => ({
    candidateProfile: {
        upsert: vi.fn(),
        findUnique: vi.fn(),
    },
    professionalProfile: {
        upsert: vi.fn(),
        findUnique: vi.fn(),
    },
}));

vi.mock('@/lib/core/db', () => ({
    prisma: mockPrisma,
}));

import { ProfileService } from '@/lib/domain/users/profile-service';

describe('ProfileService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('updateCandidateProfile', () => {
        it('should upsert candidate profile', async () => {
            const mockProfile = {
                userId: 'user1',
                interests: ['Tech', 'Finance'],
                resumeUrl: 'https://example.com/resume.pdf',
            };
            mockPrisma.candidateProfile.upsert.mockResolvedValue(mockProfile);

            const result = await ProfileService.updateCandidateProfile('user1', {
                interests: ['Tech', 'Finance'],
                resumeUrl: 'https://example.com/resume.pdf',
            });

            expect(result).toEqual(mockProfile);
            expect(mockPrisma.candidateProfile.upsert).toHaveBeenCalledWith({
                where: { userId: 'user1' },
                create: expect.objectContaining({ userId: 'user1' }),
                update: expect.any(Object),
            });
        });

        it('should handle empty interests array', async () => {
            mockPrisma.candidateProfile.upsert.mockResolvedValue({
                userId: 'user1',
                interests: [],
            });

            await ProfileService.updateCandidateProfile('user1', {
                interests: [],
            });

            expect(mockPrisma.candidateProfile.upsert).toHaveBeenCalled();
        });
    });

    describe('updateProfessionalProfile', () => {
        it('should convert dollars to cents correctly', async () => {
            mockPrisma.professionalProfile.upsert.mockResolvedValue({
                userId: 'pro1',
                priceCents: 5000,
            });

            await ProfileService.updateProfessionalProfile('pro1', {
                price: 50, // $50
            });

            expect(mockPrisma.professionalProfile.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    update: expect.objectContaining({
                        priceCents: 5000, // $50.00 = 5000 cents
                    }),
                })
            );
        });

        it('should upsert professional profile with all fields', async () => {
            const mockProfile = {
                userId: 'pro1',
                employer: 'Test Corp',
                title: 'Engineer',
                bio: 'A bio',
                priceCents: 10000,
            };
            mockPrisma.professionalProfile.upsert.mockResolvedValue(mockProfile);

            const result = await ProfileService.updateProfessionalProfile('pro1', {
                employer: 'Test Corp',
                title: 'Engineer',
                bio: 'A bio',
                price: 100,
            });

            expect(result).toEqual(mockProfile);
        });
    });

    describe('getProfileByUserId', () => {
        it('should return candidate profile for CANDIDATE role', async () => {
            const mockProfile = {
                userId: 'user1',
                interests: ['Tech'],
            };
            mockPrisma.candidateProfile.findUnique.mockResolvedValue(mockProfile);

            const result = await ProfileService.getProfileByUserId('user1', Role.CANDIDATE);

            expect(result).toEqual(mockProfile);
            expect(mockPrisma.candidateProfile.findUnique).toHaveBeenCalledWith({
                where: { userId: 'user1' },
            });
        });

        it('should return professional profile with price in dollars for PROFESSIONAL role', async () => {
            const mockProfile = {
                userId: 'pro1',
                employer: 'Test Corp',
                priceCents: 10000,
            };
            mockPrisma.professionalProfile.findUnique.mockResolvedValue(mockProfile);

            const result = await ProfileService.getProfileByUserId('pro1', Role.PROFESSIONAL);

            expect(result).toEqual({
                ...mockProfile,
                price: 100, // 10000 cents = $100
            });
        });

        it('should return null for ADMIN role (no profile)', async () => {
            const result = await ProfileService.getProfileByUserId('admin1', Role.ADMIN);

            expect(result).toBeNull();
        });

        it('should return null when professional profile not found', async () => {
            mockPrisma.professionalProfile.findUnique.mockResolvedValue(null);

            const result = await ProfileService.getProfileByUserId('unknown', Role.PROFESSIONAL);

            expect(result).toBeNull();
        });
    });
});
