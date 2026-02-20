import { Worker, Job, ConnectionOptions } from 'bullmq';
import { prisma } from '@/lib/core/db';
import { BookingStatus } from '@prisma/client';
import {
    sendFeedbackRevisionEmail,
    sendBookingRequestedEmail,
    sendBookingAcceptedEmail,
    sendBookingDeclinedEmail,
    sendPayoutReleasedEmail
} from '@/lib/integrations/email';

export function createNotificationsWorker(connection: ConnectionOptions) {
    const worker = new Worker('notifications', async (job: Job) => {
        console.log(`[NOTIFICATIONS] Processing job ${job.id}:`, job.name);

        const { type, bookingId, payoutId, reasons } = job.data;

        if (type === 'feedback_revise') {
            // 1. Fetch professional email
            const booking = await prisma.booking.findUnique({
                where: { id: bookingId },
                include: { professional: true }
            });

            if (!booking) {
                console.error(`[NOTIFICATIONS] Booking ${bookingId} not found, cannot send email.`);
                return;
            }

            const email = booking.professional.email;

            // 2. Send Email
            await sendFeedbackRevisionEmail(email, bookingId, reasons || ['Quality standards not met.']);

            console.log(`[NOTIFICATIONS] Sent revision email to ${email} for booking ${bookingId}`);
        }
        else if (type === 'booking_requested') {
            const booking = await prisma.booking.findUnique({
                where: { id: bookingId },
                include: { professional: true, candidate: true }
            });
            if (!booking) return;

            await sendBookingRequestedEmail(booking, booking.professional.email);
            console.log(`[NOTIFICATIONS] Sent booking request email to ${booking.professional.email}`);
        }
        else if (type === 'booking_accepted') {
            const booking = await prisma.booking.findUnique({
                where: { id: bookingId },
                include: { professional: true, candidate: true }
            });
            if (!booking) return;

            if (booking.status !== BookingStatus.accepted || !booking.zoomJoinUrl) {
                console.warn(`[NOTIFICATIONS] Skipping acceptance email for booking ${bookingId}: status=${booking.status}, zoomJoinUrl=${booking.zoomJoinUrl ? 'present' : 'missing'}`);
                return;
            }

            await sendBookingAcceptedEmail(booking, 'CANDIDATE');
            await sendBookingAcceptedEmail(booking, 'PROFESSIONAL');
            console.log(`[NOTIFICATIONS] Sent acceptance emails for booking ${bookingId}`);
        }
        else if (type === 'booking_declined') {
            const booking = await prisma.booking.findUnique({
                where: { id: bookingId },
                include: { professional: true, candidate: true }
            });
            if (!booking) return;

            await sendBookingDeclinedEmail(booking);
            console.log(`[NOTIFICATIONS] Sent decline email to ${booking.candidate.email}`);
        }
        else if (type === 'payout_released') {
            const payout = await prisma.payout.findUnique({
                where: { id: payoutId },
                include: { booking: { include: { professional: true } } }
            });

            if (payout) {
                const professionalEmail = payout.booking.professional.email;
                await sendPayoutReleasedEmail(payout, professionalEmail);
                console.log(`[NOTIFICATIONS] Sent payout released email to ${professionalEmail}`);
            }
        }

        return { processed: true };
    }, {
        connection,
        concurrency: 10,
    });

    worker.on('completed', (job) => {
        console.log(`[NOTIFICATIONS] Job ${job.id} completed.`);
    });

    worker.on('failed', (job, err) => {
        console.error(`[NOTIFICATIONS] Job ${job?.id} failed: ${err.message}`);
    });

    return worker;
}
