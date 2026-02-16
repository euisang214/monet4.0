import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    createResumeUrlSigner,
    extractPathFromStorageUrl,
    getSignedResumeViewUrl,
    isSupabaseResumeUrl,
} from "@/lib/integrations/resume-storage";

describe("resume-storage helpers", () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        process.env.SUPABASE_URL = "https://project-ref.supabase.co";
        process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
        process.env.SUPABASE_RESUME_BUCKET = "candidate-resumes";
    });

    afterEach(() => {
        process.env = { ...originalEnv };
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("extracts and decodes a Supabase storage path", () => {
        const url =
            "https://project-ref.supabase.co/storage/v1/object/candidate-resumes/resumes/user-1/SWE%20Resume.pdf";

        expect(extractPathFromStorageUrl(url)).toBe("resumes/user-1/SWE Resume.pdf");
        expect(isSupabaseResumeUrl(url)).toBe(true);
    });

    it("returns false and null for non-Supabase resume URLs", () => {
        const url = "https://legacy-storage.example.com/resumes/user-1/resume.pdf";

        expect(isSupabaseResumeUrl(url)).toBe(false);
        expect(extractPathFromStorageUrl(url)).toBeNull();
    });

    it("passes through non-Supabase URLs without calling the signing API", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        const legacyUrl = "https://legacy-storage.example.com/resumes/user-1/resume.pdf";
        const signed = await getSignedResumeViewUrl(legacyUrl);

        expect(signed).toBe(legacyUrl);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("signs Supabase storage URLs", async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ signedURL: "/object/sign/candidate-resumes/resumes/user-1/resume.pdf?token=abc" }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        );
        vi.stubGlobal("fetch", fetchMock);

        const storageUrl = "https://project-ref.supabase.co/storage/v1/object/candidate-resumes/resumes/user-1/resume.pdf";
        const signed = await getSignedResumeViewUrl(storageUrl);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(signed).toBe(
            "https://project-ref.supabase.co/storage/v1/object/sign/candidate-resumes/resumes/user-1/resume.pdf?token=abc"
        );
    });

    it("memoizes duplicate URL signing within the same signer instance", async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ signedURL: "/object/sign/candidate-resumes/resumes/user-1/resume.pdf?token=abc" }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        );
        vi.stubGlobal("fetch", fetchMock);

        const signer = createResumeUrlSigner();
        const storageUrl = "https://project-ref.supabase.co/storage/v1/object/candidate-resumes/resumes/user-1/resume.pdf";

        const first = await signer(storageUrl);
        const second = await signer(storageUrl);

        expect(first).toBe(second);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
