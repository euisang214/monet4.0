"use server";

import { ProfessionalRequestService } from "@/lib/role/professional/requests";
import { auth } from "@/auth";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const confirmSchema = z.object({
    bookingId: z.string(),
    startAt: z.string().transform(str => new Date(str)), // Date passed as ISO string
});

export async function confirmBookingAction(formData: FormData) {
    const session = await auth();
    if (!session || session.user.role !== Role.PROFESSIONAL) {
        return { error: "Unauthorized" };
    }

    const rawData = {
        bookingId: formData.get("bookingId"),
        startAt: formData.get("startAt"),
    };

    const result = confirmSchema.safeParse(rawData);

    if (!result.success) {
        return { error: "Invalid data" };
    }

    const { bookingId, startAt } = result.data;

    try {
        await ProfessionalRequestService.confirmAndSchedule(
            bookingId,
            session.user.id,
            startAt
        );
    } catch (error: any) {
        console.error("Confirmation failed", error);
        return { error: error.message || "Failed to confirm booking" };
    }

    // Revalidate and redirect
    revalidatePath("/professional/dashboard");
    redirect("/professional/dashboard");
}
