import { createResumeUrlSigner } from "@/lib/integrations/resume-storage";

type CandidateProfileWithResume = {
    resumeUrl?: string | null;
};

type RecordWithCandidateProfile = {
    candidate: {
        candidateProfile?: CandidateProfileWithResume | null;
    };
};

export async function signCandidateProfileResumeUrl(profile: CandidateProfileWithResume | null | undefined) {
    if (!profile?.resumeUrl) {
        return;
    }

    const signResumeUrl = createResumeUrlSigner();
    profile.resumeUrl = (await signResumeUrl(profile.resumeUrl)) ?? null;
}

export async function signCandidateResumeUrls<T extends RecordWithCandidateProfile>(records: T[]) {
    const signResumeUrl = createResumeUrlSigner();

    await Promise.all(
        records.map(async (record) => {
            const candidateProfile = record.candidate.candidateProfile;
            if (!candidateProfile?.resumeUrl) {
                return;
            }

            candidateProfile.resumeUrl = (await signResumeUrl(candidateProfile.resumeUrl)) ?? null;
        })
    );
}
