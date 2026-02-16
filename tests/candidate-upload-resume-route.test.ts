import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const uploadResumeMock = vi.hoisted(() => vi.fn());
const getSignedResumeViewUrlMock = vi.hoisted(() => vi.fn());

vi.mock("@/auth", () => ({
    auth: authMock,
}));

vi.mock("@/lib/integrations/resume-storage", () => ({
    uploadResume: uploadResumeMock,
    getSignedResumeViewUrl: getSignedResumeViewUrlMock,
    MAX_RESUME_SIZE_BYTES: 4 * 1024 * 1024,
    RESUME_CONTENT_TYPE: "application/pdf",
}));

import { POST } from "@/app/api/candidate/upload/resume/route";

function createRequestWithFile(file?: File): Request {
    const formData = new FormData();
    if (file) {
        formData.append("file", file);
    }

    return new Request("http://localhost/api/candidate/upload/resume", {
        method: "POST",
        body: formData,
    });
}

describe("POST /api/candidate/upload/resume", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 401 for unauthenticated requests", async () => {
        authMock.mockResolvedValue(null);

        const response = await POST(createRequestWithFile());
        expect(response.status).toBe(401);
    });

    it("returns 401 for non-candidate roles", async () => {
        authMock.mockResolvedValue({ user: { id: "pro-1", role: "PROFESSIONAL" } });

        const response = await POST(createRequestWithFile());
        expect(response.status).toBe(401);
    });

    it("returns 400 when file is missing", async () => {
        authMock.mockResolvedValue({ user: { id: "cand-1", role: "CANDIDATE" } });

        const response = await POST(createRequestWithFile());
        expect(response.status).toBe(400);
    });

    it("returns 400 for non-PDF files", async () => {
        authMock.mockResolvedValue({ user: { id: "cand-1", role: "CANDIDATE" } });
        const file = new File(["text"], "resume.txt", { type: "text/plain" });

        const response = await POST(createRequestWithFile(file));
        expect(response.status).toBe(400);
    });

    it("returns 400 for oversized files", async () => {
        authMock.mockResolvedValue({ user: { id: "cand-1", role: "CANDIDATE" } });
        const file = new File([new Uint8Array(4 * 1024 * 1024 + 1)], "resume.pdf", {
            type: "application/pdf",
        });

        const response = await POST(createRequestWithFile(file));
        expect(response.status).toBe(400);
    });

    it("uploads candidate resume and returns signed view URL", async () => {
        authMock.mockResolvedValue({ user: { id: "cand-1", role: "CANDIDATE" } });
        uploadResumeMock.mockResolvedValue({
            storageUrl: "https://project-ref.supabase.co/storage/v1/object/candidate-resumes/resumes/cand-1/1.pdf",
            path: "resumes/cand-1/1.pdf",
        });
        getSignedResumeViewUrlMock.mockResolvedValue(
            "https://project-ref.supabase.co/storage/v1/object/sign/candidate-resumes/resumes/cand-1/1.pdf?token=abc"
        );

        const file = new File(["pdf"], "resume.pdf", { type: "application/pdf" });
        const response = await POST(createRequestWithFile(file));
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(uploadResumeMock).toHaveBeenCalledWith("candidate", expect.any(ArrayBuffer), "application/pdf", "cand-1");
        expect(payload).toEqual({
            data: {
                storageUrl: "https://project-ref.supabase.co/storage/v1/object/candidate-resumes/resumes/cand-1/1.pdf",
                viewUrl:
                    "https://project-ref.supabase.co/storage/v1/object/sign/candidate-resumes/resumes/cand-1/1.pdf?token=abc",
            },
        });
    });
});
