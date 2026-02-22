import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Role } from '@prisma/client';

const userFindUniqueMock = vi.hoisted(() => vi.fn());
const candidateSafeParseMock = vi.hoisted(() => vi.fn());
const professionalSafeParseMock = vi.hoisted(() => vi.fn());
const upsertCandidateProfileFromPayloadMock = vi.hoisted(() => vi.fn());
const upsertProfessionalProfileFromPayloadMock = vi.hoisted(() => vi.fn());
const getProfessionalStripeStatusMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/core/db', () => ({
    prisma: {
        user: {
            findUnique: userFindUniqueMock,
        },
    },
}));

vi.mock('@/lib/domain/users/profile-upsert-service', () => ({
    candidateProfilePayloadSchema: {
        safeParse: candidateSafeParseMock,
    },
    professionalProfilePayloadSchema: {
        safeParse: professionalSafeParseMock,
    },
    upsertCandidateProfileFromPayload: upsertCandidateProfileFromPayloadMock,
    upsertProfessionalProfileFromPayload: upsertProfessionalProfileFromPayloadMock,
    buildResumeRequiredValidationError: () => ({
        error: 'validation_error',
        details: {
            fieldErrors: {
                resumeUrl: ['Resume is required'],
            },
            formErrors: [],
        },
    }),
}));

vi.mock('@/lib/domain/users/professional-stripe-status', () => ({
    getProfessionalStripeStatus: getProfessionalStripeStatusMock,
}));

import { submitProfilePayload } from '@/lib/domain/users/profile-submit-service';

describe('submitProfilePayload', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns validation_error details for invalid candidate payloads', async () => {
        candidateSafeParseMock.mockReturnValue({
            success: false,
            error: {
                flatten: () => ({
                    fieldErrors: { timezone: ['Select a valid timezone'] },
                    formErrors: [],
                }),
            },
        });

        const result = await submitProfilePayload({
            userId: 'cand-1',
            role: Role.CANDIDATE,
            body: { timezone: 'Invalid/Timezone' },
            mode: 'onboarding',
        });

        expect(result).toEqual({
            success: false,
            status: 400,
            error: 'validation_error',
            details: {
                fieldErrors: { timezone: ['Select a valid timezone'] },
                formErrors: [],
            },
        });
        expect(upsertCandidateProfileFromPayloadMock).not.toHaveBeenCalled();
    });

    it('maps candidate resume_required into a validation payload', async () => {
        const parsedPayload = { timezone: 'America/New_York' };
        candidateSafeParseMock.mockReturnValue({ success: true, data: parsedPayload });
        upsertCandidateProfileFromPayloadMock.mockResolvedValue({ success: false, error: 'resume_required' });

        const result = await submitProfilePayload({
            userId: 'cand-1',
            role: Role.CANDIDATE,
            body: parsedPayload,
            mode: 'onboarding',
        });

        expect(result).toEqual({
            success: false,
            status: 400,
            error: 'validation_error',
            details: {
                fieldErrors: {
                    resumeUrl: ['Resume is required'],
                },
                formErrors: [],
            },
        });
    });

    it('blocks professional onboarding when payouts are not ready', async () => {
        const parsedPayload = { timezone: 'America/New_York' };
        professionalSafeParseMock.mockReturnValue({ success: true, data: parsedPayload });
        userFindUniqueMock.mockResolvedValueOnce({ onboardingCompleted: false });
        getProfessionalStripeStatusMock.mockResolvedValue({ isPayoutReady: false });

        const result = await submitProfilePayload({
            userId: 'pro-1',
            role: Role.PROFESSIONAL,
            body: parsedPayload,
            mode: 'onboarding',
        });

        expect(result).toEqual({
            success: false,
            status: 400,
            error: 'stripe_payout_not_ready',
        });
        expect(upsertProfessionalProfileFromPayloadMock).not.toHaveBeenCalled();
    });

    it('upserts professional profile and returns onboarding state for settings mode', async () => {
        const parsedPayload = { timezone: 'America/New_York' };
        professionalSafeParseMock.mockReturnValue({ success: true, data: parsedPayload });
        userFindUniqueMock.mockResolvedValueOnce({
            onboardingRequired: true,
            onboardingCompleted: false,
        });

        const result = await submitProfilePayload({
            userId: 'pro-1',
            role: Role.PROFESSIONAL,
            body: parsedPayload,
            mode: 'settings',
        });

        expect(getProfessionalStripeStatusMock).not.toHaveBeenCalled();
        expect(upsertProfessionalProfileFromPayloadMock).toHaveBeenCalledWith(
            'pro-1',
            parsedPayload,
            { markOnboardingCompleted: false },
        );
        expect(result).toEqual({
            success: true,
            onboardingRequired: true,
            onboardingCompleted: false,
        });
    });
});
