import { AttendanceOutcome, BookingStatus, PaymentStatus, Role } from '@prisma/client';
import { createAuditLog } from '@/lib/shared/audit';
import { TransitionConflictError, TransitionError } from '../errors';
import {
    defaultPrisma,
    enqueueCalendarInviteCancelJobs,
    enqueueCalendarInviteRequestJobs,
    sameInstant,
    transitionBooking,
    type Dependencies,
} from './shared';
import { isLateCancellation } from '@/lib/domain/bookings/utils';

export async function acceptBooking(
    bookingId: string,
    actor: { userId: string; role: Role },
    deps: Dependencies = { prisma: defaultPrisma }
) {
    if (actor.role !== Role.PROFESSIONAL) {
        throw new TransitionError('Only professionals can accept bookings');
    }

    return transitionBooking(bookingId, BookingStatus.accepted, { actor }, deps, async (tx) => {
        const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
        if (booking.professionalId !== actor.userId) {
            throw new TransitionError('Not authorized');
        }

        if (booking.status === BookingStatus.accepted) {
            return booking;
        }

        if (booking.status !== BookingStatus.requested) {
            throw new TransitionError(`Cannot accept booking in state ${booking.status}`);
        }

        const updated = await tx.booking.update({
            where: { id: bookingId },
            data: { status: BookingStatus.accepted },
        });

        await tx.payment.updateMany({
            where: { bookingId, status: PaymentStatus.authorized },
            data: { status: PaymentStatus.held },
        });

        return updated;
    });
}

export async function startIntegrations(
    bookingId: string,
    deps: Dependencies = { prisma: defaultPrisma }
) {
    return transitionBooking(bookingId, BookingStatus.accepted_pending_integrations, { actor: 'system' }, deps, async (tx) => {
        const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
        if (booking.status === BookingStatus.accepted_pending_integrations) {
            return booking;
        }
        if (booking.status !== BookingStatus.accepted) {
            throw new TransitionError(`Cannot start integrations from ${booking.status}`);
        }
        return tx.booking.update({
            where: { id: bookingId },
            data: { status: BookingStatus.accepted_pending_integrations },
        });
    });
}

export async function acceptBookingWithIntegrations(
    bookingId: string,
    actor: { userId: string; role: Role },
    deps: Dependencies = { prisma: defaultPrisma }
) {
    if (actor.role !== Role.PROFESSIONAL) throw new TransitionError('Not authorized');

    return transitionBooking(bookingId, BookingStatus.accepted_pending_integrations, { actor }, deps, async (tx) => {
        const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
        if (booking.professionalId !== actor.userId) throw new TransitionError('Not authorized');

        if (booking.status === BookingStatus.accepted_pending_integrations) {
            return booking;
        }

        if (booking.status !== BookingStatus.requested) {
            throw new TransitionError(`Invalid status: ${booking.status}`);
        }

        const updated = await tx.booking.update({
            where: { id: bookingId },
            data: { status: BookingStatus.accepted_pending_integrations },
        });

        await tx.payment.updateMany({
            where: { bookingId, status: PaymentStatus.authorized },
            data: { status: PaymentStatus.held },
        });

        return updated;
    });
}

export async function completeIntegrations(
    bookingId: string,
    zoomData: {
        joinUrl: string;
        meetingId: string;
        candidateJoinUrl?: string | null;
        professionalJoinUrl?: string | null;
        candidateRegistrantId?: string | null;
        professionalRegistrantId?: string | null;
    },
    deps: Dependencies = { prisma: defaultPrisma }
) {
    let shouldEnqueueInviteRequests = true;

    const result = await transitionBooking(bookingId, BookingStatus.accepted, { actor: 'system' }, deps, async (tx) => {
        const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
        const hasMatchingZoomData = booking.zoomJoinUrl === zoomData.joinUrl
            && booking.zoomMeetingId === zoomData.meetingId
            && booking.candidateZoomJoinUrl === (zoomData.candidateJoinUrl ?? null)
            && booking.professionalZoomJoinUrl === (zoomData.professionalJoinUrl ?? null)
            && booking.candidateZoomRegistrantId === (zoomData.candidateRegistrantId ?? null)
            && booking.professionalZoomRegistrantId === (zoomData.professionalRegistrantId ?? null);

        if (booking.status === BookingStatus.accepted) {
            if (hasMatchingZoomData) {
                shouldEnqueueInviteRequests = false;
                return booking;
            }

            return tx.booking.update({
                where: { id: bookingId },
                data: {
                    zoomJoinUrl: zoomData.joinUrl,
                    zoomMeetingId: zoomData.meetingId,
                    candidateZoomJoinUrl: zoomData.candidateJoinUrl ?? null,
                    professionalZoomJoinUrl: zoomData.professionalJoinUrl ?? null,
                    candidateZoomRegistrantId: zoomData.candidateRegistrantId ?? null,
                    professionalZoomRegistrantId: zoomData.professionalRegistrantId ?? null,
                },
            });
        }

        if (booking.status !== BookingStatus.accepted_pending_integrations) {
            throw new TransitionError(`Invalid status: ${booking.status}`);
        }

        return tx.booking.update({
            where: { id: bookingId },
            data: {
                status: BookingStatus.accepted,
                zoomJoinUrl: zoomData.joinUrl,
                zoomMeetingId: zoomData.meetingId,
                candidateZoomJoinUrl: zoomData.candidateJoinUrl ?? null,
                professionalZoomJoinUrl: zoomData.professionalJoinUrl ?? null,
                candidateZoomRegistrantId: zoomData.candidateRegistrantId ?? null,
                professionalZoomRegistrantId: zoomData.professionalRegistrantId ?? null,
            }
        });
    });

    if (shouldEnqueueInviteRequests) {
        await enqueueCalendarInviteRequestJobs(bookingId, zoomData.meetingId);
    }

    return result;
}

export async function requestReschedule(
    bookingId: string,
    actor: { userId: string; role: Role },
    slots?: { start: Date; end: Date }[],
    reason?: string,
    deps: Dependencies = { prisma: defaultPrisma }
) {
    return transitionBooking(
        bookingId,
        BookingStatus.reschedule_pending,
        { actor, reason, metadata: { slots } },
        deps,
        async (tx) => {
            const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });

            if (booking.candidateId !== actor.userId && booking.professionalId !== actor.userId) {
                throw new TransitionError('Not authorized');
            }

            if (booking.status === BookingStatus.reschedule_pending) {
                return booking;
            }

            if (booking.status !== BookingStatus.accepted) {
                throw new TransitionError(`Cannot request reschedule from ${booking.status}`);
            }

            return tx.booking.update({
                where: { id: bookingId },
                data: { status: BookingStatus.reschedule_pending },
            });
        }
    );
}

export async function confirmReschedule(
    bookingId: string,
    actor: { userId: string; role: Role },
    newStartAt: Date,
    newEndAt: Date,
    deps: Dependencies = { prisma: defaultPrisma }
) {
    return transitionBooking(bookingId, BookingStatus.accepted, { actor }, deps, async (tx) => {
        const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });

        if (booking.candidateId !== actor.userId && booking.professionalId !== actor.userId) {
            throw new TransitionError('Not authorized');
        }

        if (booking.status === BookingStatus.accepted) {
            if (sameInstant(booking.startAt, newStartAt) && sameInstant(booking.endAt, newEndAt)) {
                return booking;
            }
            throw new TransitionConflictError('Booking is already accepted with a different schedule');
        }

        if (booking.status !== BookingStatus.reschedule_pending) {
            throw new TransitionError(`Cannot confirm reschedule from ${booking.status}`);
        }

        return tx.booking.update({
            where: { id: bookingId },
            data: {
                status: BookingStatus.accepted,
                startAt: newStartAt,
                endAt: newEndAt,
            },
        });
    });
}

export async function rejectReschedule(
    bookingId: string,
    actor: { userId: string; role: Role },
    deps: Dependencies = { prisma: defaultPrisma }
) {
    let transitioned = false;

    const result = await transitionBooking(bookingId, BookingStatus.cancelled, { actor, reason: 'Reschedule rejected' }, deps, async (tx) => {
        const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });

        if (booking.candidateId !== actor.userId && booking.professionalId !== actor.userId) {
            throw new TransitionError('Not authorized');
        }

        if (booking.status === BookingStatus.cancelled) {
            return booking;
        }

        if (booking.status !== BookingStatus.reschedule_pending) {
            throw new TransitionError(`Cannot reject reschedule from ${booking.status}`);
        }
        transitioned = true;

        let isLate = false;
        if (booking.startAt && isLateCancellation(booking.startAt)) {
            isLate = true;
        }

        if (!isLate) {
            await tx.payment.update({
                where: { bookingId },
                data: { status: PaymentStatus.refunded, refundedAmountCents: booking.priceCents || 0 }
            });
        }

        if (isLate) {
            await tx.payment.update({
                where: { bookingId },
                data: { status: PaymentStatus.released }
            });
        }

        return tx.booking.update({
            where: { id: bookingId },
            data: {
                status: BookingStatus.cancelled,
                candidateLateCancellation: isLate,
            },
        });
    });

    if (transitioned) {
        await enqueueCalendarInviteCancelJobs(bookingId);
    }

    return result;
}

export async function updateZoomDetails(
    bookingId: string,
    zoomInput: {
        zoomJoinUrl?: string;
        zoomMeetingId?: string;
        candidateZoomJoinUrl?: string;
        professionalZoomJoinUrl?: string;
    },
    actor: { userId: string; role: Role },
    deps: Dependencies = { prisma: defaultPrisma }
) {
    if (actor.role !== Role.ADMIN) {
        throw new TransitionError('Only admins can manually update Zoom details');
    }

    const booking = await deps.prisma.booking.findUnique({
        where: { id: bookingId },
        select: { status: true }
    });

    if (!booking) {
        throw new TransitionError(`Booking ${bookingId} not found`);
    }

    const shouldTransitionToAccepted = booking.status === BookingStatus.accepted_pending_integrations;
    const resolvedSharedJoinUrl = zoomInput.zoomJoinUrl
        ?? zoomInput.candidateZoomJoinUrl
        ?? zoomInput.professionalZoomJoinUrl;

    if (!resolvedSharedJoinUrl) {
        throw new TransitionError('At least one Zoom join URL is required');
    }

    const updates: {
        zoomJoinUrl: string;
        zoomMeetingId?: string;
        candidateZoomJoinUrl?: string;
        professionalZoomJoinUrl?: string;
        status?: BookingStatus;
    } = {
        zoomJoinUrl: resolvedSharedJoinUrl,
        ...(zoomInput.zoomMeetingId && { zoomMeetingId: zoomInput.zoomMeetingId }),
        ...(zoomInput.candidateZoomJoinUrl && { candidateZoomJoinUrl: zoomInput.candidateZoomJoinUrl }),
        ...(zoomInput.professionalZoomJoinUrl && { professionalZoomJoinUrl: zoomInput.professionalZoomJoinUrl }),
    };

    if (shouldTransitionToAccepted) {
        updates.status = BookingStatus.accepted;
    }

    const updated = await deps.prisma.booking.update({
        where: { id: bookingId },
        data: updates,
    });

    if (shouldTransitionToAccepted) {
        await enqueueCalendarInviteRequestJobs(
            bookingId,
            zoomInput.zoomMeetingId ?? updated.zoomMeetingId ?? 'manual'
        );
    }

    await createAuditLog(
        deps.prisma as any,
        'Booking',
        bookingId,
        'admin:zoom_link_updated',
        actor.userId,
        {
            zoomJoinUrl: resolvedSharedJoinUrl,
            zoomMeetingId: zoomInput.zoomMeetingId,
            candidateZoomJoinUrl: zoomInput.candidateZoomJoinUrl,
            professionalZoomJoinUrl: zoomInput.professionalZoomJoinUrl,
            previousStatus: booking.status,
            newStatus: updates.status ?? booking.status,
        }
    );

    return updated;
}
