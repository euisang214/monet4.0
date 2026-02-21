import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Role } from '@prisma/client';

const authMock = vi.hoisted(() => vi.fn());
const profileServiceMock = vi.hoisted(() => ({
    updateCandidateProfile: vi.fn(),
    updateProfessionalProfile: vi.fn(),
    getProfileByUserId: vi.fn(),
}));
const prismaMock = vi.hoisted(() => ({
    user: {
        findUnique: vi.fn(),
        update: vi.fn(),
    },
}));

vi.mock('@/auth', () => ({
    auth: authMock,
}));

vi.mock('@/lib/core/db', () => ({
    prisma: prismaMock,
}));

vi.mock('@/lib/domain/users/profile-service', async () => {
    const actual = await vi.importActual<typeof import('@/lib/domain/users/profile-service')>(
        '@/lib/domain/users/profile-service'
    );
    return {
        ...actual,
        ProfileService: profileServiceMock,
    };
});

vi.mock('@/lib/integrations/resume-storage', () => ({
    createResumeUrlSigner: () => async (value: string | null | undefined) => value,
}));

import { GET, PUT } from '@/app/api/shared/settings/route';

function makeRequest(body: unknown) {
    return new Request('http://localhost/api/shared/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

describe('shared settings route', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        prismaMock.user.update.mockResolvedValue({});
        prismaMock.user.findUnique.mockResolvedValue({ timezone: 'America/New_York' });
    });

    it('accepts full professional timeline updates', async () => {
        authMock.mockResolvedValue({
            user: { id: 'pro-1', role: Role.PROFESSIONAL },
        });

        const response = await PUT(
            makeRequest({
                bio: 'Experienced mentor',
                price: 150,
                corporateEmail: 'pro@example.com',
                timezone: 'America/New_York',
                interests: ['Mentorship'],
                experience: [
                    {
                        company: 'Test Corp',
                        title: 'Principal',
                        startDate: '2022-01-01',
                        isCurrent: true,
                    },
                ],
                activities: [
                    {
                        company: 'Nonprofit',
                        title: 'Advisor',
                        startDate: '2023-01-01',
                        isCurrent: true,
                    },
                ],
                education: [
                    {
                        school: 'State U',
                        degree: 'MBA',
                        fieldOfStudy: 'Business',
                        startDate: '2010-01-01',
                        endDate: '2012-01-01',
                        isCurrent: false,
                        activities: [],
                    },
                ],
            })
        );

        expect(response.status).toBe(200);
        expect(profileServiceMock.updateProfessionalProfile).toHaveBeenCalledWith(
            'pro-1',
            expect.objectContaining({
                bio: 'Experienced mentor',
                corporateEmail: 'pro@example.com',
            })
        );
    });

    it('rejects professional updates with invalid current-role state', async () => {
        authMock.mockResolvedValue({
            user: { id: 'pro-1', role: Role.PROFESSIONAL },
        });

        const response = await PUT(
            makeRequest({
                bio: 'Experienced mentor',
                price: 150,
                corporateEmail: 'pro@example.com',
                timezone: 'America/New_York',
                interests: ['Mentorship'],
                experience: [
                    {
                        company: 'Test Corp',
                        title: 'Principal',
                        startDate: '2022-01-01',
                        isCurrent: true,
                    },
                    {
                        company: 'Old Corp',
                        title: 'Manager',
                        startDate: '2020-01-01',
                        isCurrent: true,
                    },
                ],
                activities: [
                    {
                        company: 'Nonprofit',
                        title: 'Advisor',
                        startDate: '2023-01-01',
                        isCurrent: true,
                    },
                ],
                education: [
                    {
                        school: 'State U',
                        degree: 'MBA',
                        fieldOfStudy: 'Business',
                        startDate: '2010-01-01',
                        endDate: '2012-01-01',
                        isCurrent: false,
                        activities: [],
                    },
                ],
            })
        );

        expect(response.status).toBe(400);
        expect(profileServiceMock.updateProfessionalProfile).not.toHaveBeenCalled();
    });

    it('returns derived employer/title in professional GET payload', async () => {
        authMock.mockResolvedValue({
            user: { id: 'pro-1', role: Role.PROFESSIONAL },
        });

        profileServiceMock.getProfileByUserId.mockResolvedValue({
            userId: 'pro-1',
            bio: 'Experienced mentor',
            price: 150,
            employer: 'Test Corp',
            title: 'Principal',
        });

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.employer).toBe('Test Corp');
        expect(body.data.title).toBe('Principal');
        expect(body.data.timezone).toBe('America/New_York');
    });
});
