import { auth } from "@/auth"
import { AvailabilityService } from "@/lib/shared/availability"
import { z } from "zod"

const slotSchema = z.object({
    start: z.string().datetime(), // ISO string
    end: z.string().datetime(),   // ISO string
    busy: z.boolean().default(false),
})

const schema = z.object({
    slots: z.array(slotSchema),
    timezone: z.string().optional(),
})

/**
 * POST /api/candidate/availability
 * 
 * Replace all future availability slots.
 * Delegates to AvailabilityService.replaceUserAvailability.
 */
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

        const result = await AvailabilityService.replaceUserAvailability(
            session.user.id,
            parsed.data.slots,
            parsed.data.timezone || "UTC"
        )

        return Response.json({ data: result })
    } catch (error) {
        console.error("Error updating availability:", error)
        return Response.json({ error: "internal_error" }, { status: 500 })
    }
}

/**
 * GET /api/candidate/availability
 * 
 * Get user's future availability slots.
 * Delegates to AvailabilityService.getUserAvailability.
 */
export async function GET() {
    const session = await auth()
    if (!session?.user) {
        return Response.json({ error: "unauthorized" }, { status: 401 })
    }

    try {
        const slots = await AvailabilityService.getUserAvailability(session.user.id)

        return Response.json({ data: slots })
    } catch (error) {
        console.error("Error fetching availability:", error)
        return Response.json({ error: "internal_error" }, { status: 500 })
    }
}
