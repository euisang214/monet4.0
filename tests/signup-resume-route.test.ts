import { beforeEach, describe, expect, it, vi } from "vitest";

const uploadResumeMock = vi.hoisted(() => vi.fn());
const getSignedResumeViewUrlMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/integrations/resume-storage", () => ({
    uploadResume: uploadResumeMock,
    getSignedResumeViewUrl: getSignedResumeViewUrlMock,
    MAX_RESUME_SIZE_BYTES: 4 * 1024 * 1024,
    RESUME_CONTENT_TYPE: "application/pdf",
}));

import { POST } from "@/app/api/auth/signup/resume/route";

function createRequestWithFile(file?: File): Request {
    const formData = new FormData();
    if (file) {
        formData.append("file", file);
    }

    return new Request("http://localhost/api/auth/signup/resume", {
        method: "POST",
        body: formData,
    });
}

describe("POST /api/auth/signup/resume", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 400 when no file is provided", async () => {
        const response = await POST(createRequestWithFile());

        expect(response.status).toBe(400);
    });

    it("returns 400 when the file is not a PDF", async () => {
        const file = new File(["not-pdf"], "resume.txt", { type: "text/plain" });
        const response = await POST(createRequestWithFile(file));

        expect(response.status).toBe(400);
    });

    it("returns 400 when file exceeds 4MB", async () => {
        const oversized = new File([new Uint8Array(4 * 1024 * 1024 + 1)], "resume.pdf", {
            type: "application/pdf",
        });
        const response = await POST(createRequestWithFile(oversized));

        expect(response.status).toBe(400);
    });

    it("uploads and returns storage + signed view URLs", async () => {
        uploadResumeMock.mockResolvedValue({
            storageUrl: "https://project-ref.supabase.co/storage/v1/object/candidate-resumes/resumes/signup/1.pdf",
            path: "resumes/signup/1.pdf",
        });
        getSignedResumeViewUrlMock.mockResolvedValue(
            "https://project-ref.supabase.co/storage/v1/object/sign/candidate-resumes/resumes/signup/1.pdf?token=abc"
        );

        const file = new File(["pdf"], "resume.pdf", { type: "application/pdf" });
        const response = await POST(createRequestWithFile(file));
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(uploadResumeMock).toHaveBeenCalledWith("signup", expect.any(ArrayBuffer), "application/pdf");
        expect(getSignedResumeViewUrlMock).toHaveBeenCalledWith(
            "https://project-ref.supabase.co/storage/v1/object/candidate-resumes/resumes/signup/1.pdf"
        );
        expect(payload).toEqual({
            data: {
                storageUrl: "https://project-ref.supabase.co/storage/v1/object/candidate-resumes/resumes/signup/1.pdf",
                viewUrl:
                    "https://project-ref.supabase.co/storage/v1/object/sign/candidate-resumes/resumes/signup/1.pdf?token=abc",
            },
        });
    });

    it("returns 500 when upload integration throws", async () => {
        uploadResumeMock.mockRejectedValue(new Error("upload failed"));
        const file = new File(["pdf"], "resume.pdf", { type: "application/pdf" });

        const response = await POST(createRequestWithFile(file));

        expect(response.status).toBe(500);
    });
});
