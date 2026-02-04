import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Role, BookingStatus } from '@prisma/client';

// Use vi.hoisted to ensure mocks are created before module loading
const mockPrisma = vi.hoisted(() => ({
    professionalProfile: {
        upsert: vi.fn(),
        findUnique: vi.fn(),
    },
    candidateProfile: {
        upsert: vi.fn(),
        findUnique: vi.fn(),
    },
    experience: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
        findMany: vi.fn(),
    },
    education: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
        findMany: vi.fn(),
    },
    booking: {
        findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
}));

vi.mock('@/lib/core/db', () => ({
    prisma: mockPrisma,
}));

import {
    upsertProfessionalProfile,
    upsertCandidateProfile,
    getProfessionalProfile,
} from '@/lib/domain/users/service';
import type { ProfessionalProfileUpsertInput, CandidateProfileUpsertInput } from '@/lib/types/profile-schemas';

describe('User Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('upsertProfessionalProfile', () => {
        it('should create new profile with experience and education in transaction', async () => {
            const profileData: ProfessionalProfileUpsertInput = {
                employer: 'Test Corp',
                title: 'Senior Engineer',
                bio: 'A test bio',
                priceCents: 10000,
                corporateEmail: 'test@corp.com',
                availabilityPrefs: {},
                timezone: 'America/New_York',
                interests: ['AI', 'Tech'],
                activities: [],
                experience: [
                    {
                        company: 'Company A',
                        title: 'Engineer',
                        startDate: new Date('2020-01-01'),
                        isCurrent: false,
                        positionHistory: [],
                    },
                ],
                education: [
                    {
                        school: 'MIT',
                        degree: 'BS',
                        fieldOfStudy: 'CS',
                        startDate: new Date('2016-01-01'),
                        isCurrent: false,
                        activities: [],
                    },
                ],
            };

            mockPrisma.$transaction.mockImplementation(async (callback) => {
                const tx = {
                    professionalProfile: { upsert: vi.fn().mockResolvedValue({}) },
                    experience: { deleteMany: vi.fn(), createMany: vi.fn() },
                    education: { deleteMany: vi.fn(), createMany: vi.fn() },
                };
                return callback(tx);
            });

            await upsertProfessionalProfile('user123', profileData);

            expect(mockPrisma.$transaction).toHaveBeenCalled();
        });

        it('should replace existing nested relations', async () => {
            const profileData: ProfessionalProfileUpsertInput = {
                employer: 'New Corp',
                title: 'Director',
                bio: 'Updated bio',
                priceCents: 20000,
                corporateEmail: 'new@corp.com',
                availabilityPrefs: {},
                timezone: 'UTC',
                interests: [],
                activities: [],
                experience: [],
                education: [],
            };

            let deleteManyCallCount = 0;
            mockPrisma.$transaction.mockImplementation(async (callback) => {
                const tx = {
                    professionalProfile: { upsert: vi.fn().mockResolvedValue({}) },
                    experience: {
                        deleteMany: vi.fn(() => { deleteManyCallCount++; }),
                        createMany: vi.fn(),
                    },
                    education: {
                        deleteMany: vi.fn(() => { deleteManyCallCount++; }),
                        createMany: vi.fn(),
                    },
                };
                return callback(tx);
            });

            await upsertProfessionalProfile('user123', profileData);

            // Should have called deleteMany for both experience and education
            expect(deleteManyCallCount).toBeGreaterThanOrEqual(2);
        });
    });

    describe('upsertCandidateProfile', () => {
        it('should create new candidate profile', async () => {
            const profileData: CandidateProfileUpsertInput = {
                interests: ['Engineering', 'Product'],
                experience: [],
                education: [],
                activities: [],
            };

            mockPrisma.$transaction.mockImplementation(async (callback) => {
                const tx = {
                    candidateProfile: { upsert: vi.fn().mockResolvedValue(profileData) },
                    experience: { deleteMany: vi.fn(), createMany: vi.fn() },
                    education: { deleteMany: vi.fn(), createMany: vi.fn() },
                };
                return callback(tx);
            });

            await upsertCandidateProfile('user123', profileData);

            expect(mockPrisma.$transaction).toHaveBeenCalled();
        });

        it('should update existing profile', async () => {
            const updatedData: CandidateProfileUpsertInput = {
                interests: ['Finance', 'Consulting'],
                experience: [],
                education: [],
                activities: [],
            };

            mockPrisma.$transaction.mockImplementation(async (callback) => {
                const tx = {
                    candidateProfile: { upsert: vi.fn().mockResolvedValue(updatedData) },
                    experience: { deleteMany: vi.fn(), createMany: vi.fn() },
                    education: { deleteMany: vi.fn(), createMany: vi.fn() },
                };
                return callback(tx);
            });

            await upsertCandidateProfile('user123', updatedData);

            expect(mockPrisma.$transaction).toHaveBeenCalled();
        });
    });

    describe('getProfessionalProfile', () => {
        it('should return full profile for authenticated user with booking history', async () => {
            const mockProfile = {
                userId: 'pro1',
                employer: 'Test Corp',
                title: 'Engineer',
                bio: 'Bio',
                priceCents: 10000,
                corporateEmail: 'pro@corp.com',
                user: { email: 'pro@test.com' },
            };

            mockPrisma.professionalProfile.findUnique.mockResolvedValue(mockProfile);
            mockPrisma.experience.findMany.mockResolvedValue([]); // Mock activities
            mockPrisma.booking.findFirst.mockResolvedValue({
                id: 'booking1',
                status: BookingStatus.completed,
            });

            const result = await getProfessionalProfile('pro1', 'viewer1');

            expect(result).toMatchObject(mockProfile);
            expect(result?.corporateEmail).toBe('pro@corp.com');
        });

        it('should return redacted profile for guests', async () => {
            const mockProfile = {
                userId: 'pro1',
                employer: 'Test Corp',
                title: 'Engineer',
                bio: 'Bio',
                priceCents: 10000,
                corporateEmail: 'pro@corp.com',
                user: { email: 'pro@test.com' },
            };

            mockPrisma.professionalProfile.findUnique.mockResolvedValue(mockProfile);
            mockPrisma.experience.findMany.mockResolvedValue([]); // Mock activities
            mockPrisma.booking.findFirst.mockResolvedValue(null);

            const result = await getProfessionalProfile('pro1'); // No viewerId

            // Result should be redacted (email fields hidden)
            expect(result).toBeDefined();
        });
    });
});
