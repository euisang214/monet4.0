import { z } from "zod";

export const CreateBookingRequestSchema = z.object({
    professionalId: z.string().cuid(),
    weeks: z.number().int().min(1).max(12).default(1),
    message: z.string().optional(), // Optional initial message
});

export type CreateBookingRequestInput = z.infer<typeof CreateBookingRequestSchema>;
