import {
    getSignedResumeViewUrl,
    MAX_RESUME_SIZE_BYTES,
    RESUME_CONTENT_TYPE,
    uploadResume,
} from "@/lib/integrations/resume-storage";

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get("file");

        if (!(file instanceof File)) {
            return Response.json({ error: "validation_error" }, { status: 400 });
        }

        if (file.size <= 0 || file.size > MAX_RESUME_SIZE_BYTES) {
            return Response.json({ error: "validation_error" }, { status: 400 });
        }

        const isPdf = file.type === RESUME_CONTENT_TYPE || file.name.toLowerCase().endsWith(".pdf");
        if (!isPdf) {
            return Response.json({ error: "validation_error" }, { status: 400 });
        }

        const fileBuffer = await file.arrayBuffer();
        const { storageUrl } = await uploadResume("signup", fileBuffer, RESUME_CONTENT_TYPE);
        const viewUrl = await getSignedResumeViewUrl(storageUrl);

        return Response.json({ data: { storageUrl, viewUrl } });
    } catch (error) {
        console.error("Error uploading signup resume:", error);
        return Response.json({ error: "internal_error" }, { status: 500 });
    }
}
