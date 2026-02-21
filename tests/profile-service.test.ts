import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Role } from '@prisma/client';

const mockUpsertProfessionalProfile = vi.hoisted(() => vi.fn());

const mockPrisma = vi.hoisted(() => ({
    candidateProfile: {
        upsert: vi.fn(),
        findUnique: vi.fn(),
    },
    professionalProfile: {
        findUnique: vi.fn(),
    },
}));

vi.mock('@/lib/core/db', () => ({
    prisma: mockPrisma,
}));

vi.mock('@/lib/domain/users/service', () => ({
    upsertProfessionalProfile: mockUpsertProfessionalProfile,
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
    });

    describe('updateProfessionalProfile', () => {
        it('should map dollars to cents and delegate nested upsert', async () => {
            mockPrisma.professionalProfile.findUnique.mockResolvedValue({
                availabilityPrefs: { window: 'weekday' },
            });
            mockUpsertProfessionalProfile.mockResolvedValue({ userId: 'pro1' });

            await ProfileService.updateProfessionalProfile('pro1', {
                bio: 'A bio',
                price: 50,
                corporateEmail: 'pro@test.com',
                timezone: 'America/New_York',
                interests: ['Mentorship'],
                experience: [
                    {
                        company: 'Test Corp',
                        title: 'Engineer',
                        startDate: new Date('2020-01-01'),
                        isCurrent: true,
                        positionHistory: [],
                    },
                ],
                activities: [
                    {
                        company: 'Community Group',
                        title: 'Advisor',
                        startDate: new Date('2021-01-01'),
                        isCurrent: true,
                        positionHistory: [],
                    },
                ],
                education: [
                    {
                        school: 'State U',
                        degree: 'BS',
                        fieldOfStudy: 'CS',
                        startDate: new Date('2014-01-01'),
                        isCurrent: false,
                        activities: [],
                    },
                ],
            });

            expect(mockUpsertProfessionalProfile).toHaveBeenCalledWith(
                'pro1',
                expect.objectContaining({
                    bio: 'A bio',
                    priceCents: 5000,
                    availabilityPrefs: { window: 'weekday' },
                    corporateEmail: 'pro@test.com',
                    timezone: 'America/New_York',
                })
            );
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

        it('should return professional profile with derived title/employer and price in dollars', async () => {
            mockPrisma.professionalProfile.findUnique.mockResolvedValue({
                userId: 'pro1',
                bio: 'A bio',
                priceCents: 10000,
                corporateEmail: 'pro@test.com',
                timezone: 'America/New_York',
                interests: ['Mentorship'],
                experience: [
                    {
                        id: 'exp_1',
                        title: 'Engineer',
                        company: 'Test Corp',
                        isCurrent: true,
                        startDate: new Date('2022-01-01'),
                    },
                ],
                activities: [],
                education: [],
            });

            const result = await ProfileService.getProfileByUserId('pro1', Role.PROFESSIONAL);

            expect(result).toEqual(
                expect.objectContaining({
                    userId: 'pro1',
                    price: 100,
                    title: 'Engineer',
                    employer: 'Test Corp',
                })
            );
        });

        it('should return null for ADMIN role (no profile)', async () => {
            const result = await ProfileService.getProfileByUserId('admin1', Role.ADMIN);

            expect(result).toBeNull();
        });
    });
});
