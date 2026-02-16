import { randomUUID } from "crypto";
import { s3 } from "@/lib/integrations/s3";
import { z } from "zod";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const schema = z.object({
    contentType: z.literal("application/pdf"),
    size: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
});

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const parsed = schema.safeParse(body);

        if (!parsed.success) {
            return Response.json({ error: "validation_error" }, { status: 400 });
        }

        const key = `resumes/signup/${Date.now()}-${randomUUID()}.pdf`;
        const { uploadUrl, publicUrl } = await s3.getPresignedUploadUrl(key, parsed.data.contentType);

        return Response.json({ data: { uploadUrl, publicUrl } });
    } catch (error) {
        console.error("Error generating signup resume upload URL:", error);
        return Response.json({ error: "internal_error" }, { status: 500 });
    }
}
