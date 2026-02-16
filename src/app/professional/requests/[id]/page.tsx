import { requireRole } from "@/lib/core/api-helpers";
import { prisma } from "@/lib/core/db";
import { appRoutes } from "@/lib/shared/routes";
import { Role } from "@prisma/client";
import { notFound, redirect } from "next/navigation";

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function ProfessionalRequestRouteResolver({ params }: PageProps) {
    const { id } = await params;
    const user = await requireRole(Role.PROFESSIONAL, appRoutes.professional.requestDetails(id));

    const booking = await prisma.booking.findUnique({
        where: { id },
        select: {
            status: true,
            professionalId: true,
        },
    });

    if (!booking) {
        notFound();
    }

    if (booking.professionalId !== user.id) {
        redirect(appRoutes.professional.requests);
    }

    if (booking.status === "requested") {
        redirect(appRoutes.professional.requestConfirmAndSchedule(id));
    }

    if (booking.status === "reschedule_pending") {
        redirect(appRoutes.professional.requestReschedule(id));
    }

    redirect(appRoutes.professional.requests);
}
