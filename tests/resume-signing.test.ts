import { beforeEach, describe, expect, it, vi } from 'vitest';

const signResumeUrlMock = vi.hoisted(() => vi.fn());
const createResumeUrlSignerMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/integrations/resume-storage', () => ({
    createResumeUrlSigner: createResumeUrlSignerMock,
}));

import { signCandidateProfileResumeUrl, signCandidateResumeUrls } from '@/lib/shared/resume-signing';

describe('resume-signing helpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        createResumeUrlSignerMock.mockReturnValue(signResumeUrlMock);
        signResumeUrlMock.mockImplementation(async (url: string | null | undefined) => {
            if (!url) {
                return null;
            }

            return url.includes('/storage/v1/object/candidate-resumes/') ? `${url}?signed=1` : url;
        });
    });

    it('signCandidateResumeUrls mutates only candidate resume URLs', async () => {
        const rows = [
            {
                id: 'booking-1',
                candidate: {
                    candidateProfile: {
                        resumeUrl: 'https://project-ref.supabase.co/storage/v1/object/candidate-resumes/resumes/cand-1/resume.pdf',
                    },
                },
            },
            {
                id: 'booking-2',
                candidate: {
                    candidateProfile: {
                        resumeUrl: 'https://legacy-storage.example.com/resumes/cand-2/resume.pdf',
                    },
                },
            },
            {
                id: 'booking-3',
                candidate: {
                    candidateProfile: null,
                },
            },
        ];

        await signCandidateResumeUrls(rows);

        expect(createResumeUrlSignerMock).toHaveBeenCalledTimes(1);
        expect(rows[0].candidate.candidateProfile?.resumeUrl).toContain('?signed=1');
        expect(rows[1].candidate.candidateProfile?.resumeUrl).toBe('https://legacy-storage.example.com/resumes/cand-2/resume.pdf');
    });

    it('signCandidateProfileResumeUrl signs in place and handles missing profile', async () => {
        const profile = {
            resumeUrl: 'https://project-ref.supabase.co/storage/v1/object/candidate-resumes/resumes/cand-1/resume.pdf',
        };

        await signCandidateProfileResumeUrl(profile);
        await signCandidateProfileResumeUrl(null);

        expect(createResumeUrlSignerMock).toHaveBeenCalledTimes(1);
        expect(profile.resumeUrl).toBe(
            'https://project-ref.supabase.co/storage/v1/object/candidate-resumes/resumes/cand-1/resume.pdf?signed=1'
        );
    });
});
