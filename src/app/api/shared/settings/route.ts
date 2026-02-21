import { auth } from "@/auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/core/db";
import { ProfileService } from "@/lib/domain/users/profile-service";
import {
    buildResumeRequiredValidationError,
    candidateProfilePayloadSchema,
    getCandidateProfileForSettings,
    professionalProfilePayloadSchema,
    upsertCandidateProfileFromPayload,
    upsertProfessionalProfileFromPayload,
} from "@/lib/domain/users/profile-upsert-service";

export async function PUT(request: Request) {
    const session = await auth();
    if (!session?.user) {
        return Response.json({ error: "unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const role = session.user.role as Role;

        if (role === Role.CANDIDATE) {
            const parsed = candidateProfilePayloadSchema.safeParse(body);
            if (!parsed.success) {
                return Response.json({ error: "validation_error", details: parsed.error.flatten() }, { status: 400 });
            }

            const result = await upsertCandidateProfileFromPayload(session.user.id, parsed.data);
            if (!result.success && result.error === "resume_required") {
                return Response.json(buildResumeRequiredValidationError(), { status: 400 });
            }
        } else if (role === Role.PROFESSIONAL) {
            const parsed = professionalProfilePayloadSchema.safeParse(body);
            if (!parsed.success) {
                return Response.json({ error: "validation_error", details: parsed.error.flatten() }, { status: 400 });
            }

            await upsertProfessionalProfileFromPayload(session.user.id, parsed.data);
        }

        return Response.json({ data: { success: true } });
    } catch (error) {
        console.error("Error updating settings:", error);
        return Response.json({ error: "internal_error" }, { status: 500 });
    }
}

export async function GET() {
    const session = await auth();
    if (!session?.user) {
        return Response.json({ error: "unauthorized" }, { status: 401 });
    }

    try {
        const role = session.user.role as Role;
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { timezone: true },
        });

        if (role === Role.CANDIDATE) {
            const profile = await getCandidateProfileForSettings(session.user.id);
            return Response.json({
                data: profile
                    ? {
                          ...profile,
                          timezone: user?.timezone || "UTC",
                      }
                    : profile,
            });
        }

        const profile = await ProfileService.getProfileByUserId(session.user.id, role);

        return Response.json({
            data: profile
                ? {
                      ...profile,
                      timezone: user?.timezone || "UTC",
                  }
                : profile,
        });
    } catch (error) {
        console.error("Error fetching settings:", error);
        return Response.json({ error: "internal_error" }, { status: 500 });
    }
}
