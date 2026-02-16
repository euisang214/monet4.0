import { auth } from "@/auth"
import { Role } from "@prisma/client"
import {
    ProfileService,
    candidateProfileSchema,
    professionalProfileSchema
} from "@/lib/domain/users/profile-service"
import { createResumeUrlSigner } from "@/lib/integrations/resume-storage"

export async function PUT(request: Request) {
    const session = await auth()
    if (!session?.user) {
        return Response.json({ error: "unauthorized" }, { status: 401 })
    }

    try {
        const body = await request.json()
        const role = session.user.role as Role

        if (role === Role.CANDIDATE) {
            const parsed = candidateProfileSchema.safeParse(body)
            if (!parsed.success) return Response.json({ error: "validation_error" }, { status: 400 })

            await ProfileService.updateCandidateProfile(session.user.id, parsed.data)
        } else if (role === Role.PROFESSIONAL) {
            const parsed = professionalProfileSchema.safeParse(body)
            if (!parsed.success) return Response.json({ error: "validation_error" }, { status: 400 })

            await ProfileService.updateProfessionalProfile(session.user.id, parsed.data)
        }

        return Response.json({ data: { success: true } })
    } catch (error) {
        console.error("Error updating settings:", error)
        return Response.json({ error: "internal_error" }, { status: 500 })
    }
}

export async function GET() {
    const session = await auth()
    if (!session?.user) {
        return Response.json({ error: "unauthorized" }, { status: 401 })
    }

    try {
        const role = session.user.role as Role
        const profile = await ProfileService.getProfileByUserId(
            session.user.id,
            role
        )

        if (role === Role.CANDIDATE && profile) {
            const signResumeUrl = createResumeUrlSigner()
            const candidateProfile = profile as { resumeUrl?: string | null }
            candidateProfile.resumeUrl = (await signResumeUrl(candidateProfile.resumeUrl)) ?? null
        }

        return Response.json({ data: profile })
    } catch (error) {
        console.error("Error fetching settings:", error)
        return Response.json({ error: "internal_error" }, { status: 500 })
    }
}
