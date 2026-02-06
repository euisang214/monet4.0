import { z } from "zod";

const AvailabilitySlotSchema = z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
}).superRefine((value, ctx) => {
    const start = new Date(value.start);
    const end = new Date(value.end);

    if (!(end > start)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Availability slot end must be after start.",
            path: ['end'],
        });
        return;
    }

    const durationMs = end.getTime() - start.getTime();
    const slotMs = 30 * 60 * 1000;
    if (durationMs % slotMs !== 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Availability slots must be in 30-minute increments.",
            path: ['end'],
        });
    }
});

export const CreateBookingRequestSchema = z.object({
    professionalId: z.string().cuid(),
    weeks: z.number().int().min(1).max(12).default(1),
    message: z.string().optional(), // Optional initial message
    availabilitySlots: z.array(AvailabilitySlotSchema)
        .min(1, "At least one availability slot is required.")
        .max(2000),
    timezone: z.string().min(1).max(120).optional(),
});

export type CreateBookingRequestInput = z.infer<typeof CreateBookingRequestSchema>;
