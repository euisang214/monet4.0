import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingStatus } from '@prisma/client';

vi.mock('@/lib/integrations/zoom-attendance', () => ({
    ZOOM_ATTENDANCE_ENFORCEMENT: false,
    ZOOM_ATTENDANCE_EVENT_RETENTION_DAYS: 180,
    ZOOM_ATTENDANCE_FINAL_CHECK_MINUTES: 20,
    ZOOM_ATTENDANCE_INITIAL_CHECK_MINUTES: 10,
    isZoomParticipantJoinedEvent: vi.fn(() => false),
    normalizeEmail: vi.fn((value: string | null | undefined) => value ?? null),
    parseZoomAttendancePayload: vi.fn(() => ({
        meetingId: null,
        meetingUuid: null,
        participantId: null,
        participantUserId: null,
        participantRegistrantId: null,
        participantEmail: null,
        participantName: null,
        eventTs: new Date(),
    })),
}));

vi.mock('@/lib/core/db', () => ({
    prisma: {
        $transaction: vi.fn(async (callback: any) => callback({ auditLog: { create: vi.fn() } })),
        booking: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            update: vi.fn(),
        },
        zoomAttendanceEvent: {
            count: vi.fn().mockResolvedValue(0),
            findUnique: vi.fn(),
            update: vi.fn(),
            deleteMany: vi.fn(),
        },
    },
}));

vi.mock('@/lib/domain/bookings/transitions', () => ({
    expireBooking: vi.fn(),
    completeCall: vi.fn(),
    cancelBooking: vi.fn(),
    initiateDispute: vi.fn(),
    completeIntegrations: vi.fn(),
}));

vi.mock('@/lib/integrations/zoom', () => ({
    createZoomMeeting: vi.fn(),
}));

vi.mock('@/lib/integrations/stripe', () => ({
    cancelPaymentIntent: vi.fn(),
}));

import { prisma } from '@/lib/core/db';
import { completeCall, cancelBooking, initiateDispute } from '@/lib/domain/bookings/transitions';
import { processNoShowCheck } from '@/lib/queues/bookings';

describe('processNoShowCheck with enforcement disabled', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not execute terminal transitions even when both joined', async () => {
        vi.mocked(prisma.booking.findMany).mockResolvedValue([
            {
                id: 'booking_enforcement_off',
                status: BookingStatus.accepted,
                startAt: new Date(Date.now() - 30 * 60 * 1000),
                candidateJoinedAt: new Date(),
                professionalJoinedAt: new Date(),
                attendanceOutcome: null,
            },
        ] as any);

        await processNoShowCheck();

        expect(completeCall).not.toHaveBeenCalled();
        expect(cancelBooking).not.toHaveBeenCalled();
        expect(initiateDispute).not.toHaveBeenCalled();
    });
});
