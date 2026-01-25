import { auth } from "@/auth"
import { s3 } from "@/lib/integrations/s3"
import { z } from "zod"

const schema = z.object({
    contentType: z.enum(["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]),
    size: z.number().max(5 * 1024 * 1024), // Max 5MB
})

export async function POST(request: Request) {
    const session = await auth()
    if (!session?.user || session.user.role !== "CANDIDATE") {
        return Response.json({ error: "unauthorized" }, { status: 401 })
    }

    try {
        const body = await request.json()
        const parsed = schema.safeParse(body)

        if (!parsed.success) {
            return Response.json({ error: "validation_error" }, { status: 400 })
        }

        const { contentType } = parsed.data
        const ext = contentType === "application/pdf" ? "pdf" : "docx"
        const key = `resumes/${session.user.id}/${Date.now()}.${ext}`

        const { uploadUrl, publicUrl } = await s3.getPresignedUploadUrl(key, contentType)

        return Response.json({ data: { uploadUrl, publicUrl } })
    } catch (error) {
        console.error("Error generating upload URL:", error)
        return Response.json({ error: "internal_error" }, { status: 500 })
    }
}
