import { prisma } from "@/lib/core/db";

export async function getCandidateChats(candidateId: string) {
    return prisma.booking.findMany({
        where: { candidateId },
        include: {
            professional: {
                include: {
                    professionalProfile: true,
                },
            },
            payment: true,
            feedback: true,
        },
        orderBy: [
            { startAt: "desc" },
            { expiresAt: "desc" },
            { id: "desc" },
        ],
    });
}
