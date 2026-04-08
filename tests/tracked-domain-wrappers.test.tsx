import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const executeTrackedActionMock = vi.hoisted(() => vi.fn(async (_runtime, config) => config.action()));
const runTrackedRequestMock = vi.hoisted(() => vi.fn());
const routerPushMock = vi.hoisted(() => vi.fn());
const routerReplaceMock = vi.hoisted(() => vi.fn());
const routerRefreshMock = vi.hoisted(() => vi.fn());

const createCandidateBookingRequestMock = vi.hoisted(() => vi.fn());
const cancelCandidateBookingMock = vi.hoisted(() => vi.fn());
const submitCandidateRescheduleRequestMock = vi.hoisted(() => vi.fn());
const submitCandidateReviewMock = vi.hoisted(() => vi.fn());
const submitCandidateDisputeMock = vi.hoisted(() => vi.fn());

const confirmProfessionalBookingMock = vi.hoisted(() => vi.fn());
const cancelProfessionalUpcomingBookingMock = vi.hoisted(() => vi.fn());
const rejectProfessionalRequestMock = vi.hoisted(() => vi.fn());
const submitProfessionalFeedbackMock = vi.hoisted(() => vi.fn());
const confirmProfessionalRescheduleMock = vi.hoisted(() => vi.fn());
const submitProfessionalRescheduleProposalMock = vi.hoisted(() => vi.fn());
const rejectProfessionalRescheduleMock = vi.hoisted(() => vi.fn());

const requestVerificationCodeMock = vi.hoisted(() => vi.fn());
const confirmVerificationCodeMock = vi.hoisted(() => vi.fn());

const resolveAdminDisputeMock = vi.hoisted(() => vi.fn());
const updateAdminZoomLinksMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: routerPushMock,
        replace: routerReplaceMock,
        refresh: routerRefreshMock,
    }),
}));

vi.mock('@/components/ui/providers/RequestToastProvider', () => ({
    useTrackedRequest: () => ({
        runTrackedRequest: runTrackedRequestMock,
        showToast: vi.fn(),
        dismissToast: vi.fn(),
        navigateWithToast: vi.fn(),
        currentToast: null,
    }),
}));

vi.mock('@/components/ui/actions/executeTrackedAction', () => ({
    executeTrackedAction: executeTrackedActionMock,
}));

vi.mock('@/components/bookings/services/candidateBookingApi', () => ({
    createCandidateBookingRequest: createCandidateBookingRequestMock,
    cancelCandidateBooking: cancelCandidateBookingMock,
    submitCandidateRescheduleRequest: submitCandidateRescheduleRequestMock,
    submitCandidateReview: submitCandidateReviewMock,
    submitCandidateDispute: submitCandidateDisputeMock,
}));

vi.mock('@/components/bookings/services/professionalBookingApi', () => ({
    confirmProfessionalBooking: confirmProfessionalBookingMock,
    cancelProfessionalUpcomingBooking: cancelProfessionalUpcomingBookingMock,
    rejectProfessionalRequest: rejectProfessionalRequestMock,
    submitProfessionalFeedback: submitProfessionalFeedbackMock,
}));

vi.mock('@/components/bookings/services/professionalRescheduleApi', () => ({
    confirmProfessionalReschedule: confirmProfessionalRescheduleMock,
    submitProfessionalRescheduleProposal: submitProfessionalRescheduleProposalMock,
    rejectProfessionalReschedule: rejectProfessionalRescheduleMock,
}));

vi.mock('@/components/auth/services/verificationApi', () => ({
    requestVerificationCode: requestVerificationCodeMock,
    confirmVerificationCode: confirmVerificationCodeMock,
}));

vi.mock('@/components/admin/services/adminMutationApi', () => ({
    resolveAdminDispute: resolveAdminDisputeMock,
    updateAdminZoomLinks: updateAdminZoomLinksMock,
}));

import { useTrackedCandidateBookingActions } from '@/components/bookings/hooks/useTrackedCandidateBookingActions';
import { useTrackedProfessionalBookingActions } from '@/components/bookings/hooks/useTrackedProfessionalBookingActions';
import { useTrackedVerificationActions } from '@/components/auth/hooks/useTrackedVerificationActions';
import { useTrackedAdminActions } from '@/components/admin/hooks/useTrackedAdminActions';

function createCapture<T>() {
    let value: T | null = null;

    return {
        set(nextValue: T) {
            value = nextValue;
        },
        get() {
            if (value === null) {
                throw new Error('Expected the hook value to be captured during render.');
            }

            return value;
        },
    };
}

describe('tracked domain wrappers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('candidate wrappers use the current review copy and booking-details navigation', async () => {
        const capture = createCapture<ReturnType<typeof useTrackedCandidateBookingActions>>();

        function Harness({ onReady }: { onReady: (actions: ReturnType<typeof useTrackedCandidateBookingActions>) => void }) {
            onReady(useTrackedCandidateBookingActions());
            return null;
        }

        renderToStaticMarkup(<Harness onReady={capture.set} />);
        const actions = capture.get();

        await actions.submitReview({
            bookingId: 'booking-1',
            rating: 5,
            text: 'Great review',
            timezone: 'America/New_York',
        });

        expect(submitCandidateReviewMock).toHaveBeenCalledWith({
            bookingId: 'booking-1',
            rating: 5,
            text: 'Great review',
            timezone: 'America/New_York',
        });

        expect(executeTrackedActionMock).toHaveBeenCalledWith(
            expect.objectContaining({
                runTrackedRequest: runTrackedRequestMock,
                push: routerPushMock,
                replace: routerReplaceMock,
                refresh: routerRefreshMock,
            }),
            expect.objectContaining({
                postSuccess: {
                    kind: 'push',
                    href: '/candidate/bookings/booking-1',
                },
                copy: expect.objectContaining({
                    pending: expect.objectContaining({ title: 'Submitting review' }),
                    success: expect.objectContaining({ title: 'Review submitted' }),
                }),
            }),
        );
    });

    it('professional wrappers preserve refresh behavior for cancel and dashboard navigation for confirm', async () => {
        const capture = createCapture<ReturnType<typeof useTrackedProfessionalBookingActions>>();

        function Harness({ onReady }: { onReady: (actions: ReturnType<typeof useTrackedProfessionalBookingActions>) => void }) {
            onReady(useTrackedProfessionalBookingActions());
            return null;
        }

        renderToStaticMarkup(<Harness onReady={capture.set} />);
        const actions = capture.get();

        await actions.cancelUpcomingBooking({ bookingId: 'booking-2' });
        await actions.confirmBooking({ bookingId: 'booking-3', startAt: '2026-03-02T15:00:00.000Z' });

        expect(cancelProfessionalUpcomingBookingMock).toHaveBeenCalledWith({ bookingId: 'booking-2' });
        expect(confirmProfessionalBookingMock).toHaveBeenCalledWith({
            bookingId: 'booking-3',
            startAt: '2026-03-02T15:00:00.000Z',
        });

        expect(executeTrackedActionMock).toHaveBeenNthCalledWith(
            1,
            expect.any(Object),
            expect.objectContaining({
                postSuccess: { kind: 'refresh' },
                copy: expect.objectContaining({
                    pending: expect.objectContaining({ title: 'Cancelling booking' }),
                }),
            }),
        );
        expect(executeTrackedActionMock).toHaveBeenNthCalledWith(
            2,
            expect.any(Object),
            expect.objectContaining({
                postSuccess: {
                    kind: 'push',
                    href: '/professional/dashboard',
                },
                copy: expect.objectContaining({
                    pending: expect.objectContaining({ title: 'Confirming booking' }),
                }),
            }),
        );
    });

    it('professional reschedule navigation pushes directly without a mutation', async () => {
        const capture = createCapture<ReturnType<typeof useTrackedProfessionalBookingActions>>();

        function Harness({ onReady }: { onReady: (actions: ReturnType<typeof useTrackedProfessionalBookingActions>) => void }) {
            onReady(useTrackedProfessionalBookingActions());
            return null;
        }

        renderToStaticMarkup(<Harness onReady={capture.set} />);
        const actions = capture.get();

        await actions.requestReschedule({ bookingId: 'booking-4' });

        expect(routerPushMock).toHaveBeenCalledWith('/professional/requests/booking-4/reschedule');
        expect(executeTrackedActionMock).not.toHaveBeenCalled();
    });

    it('verification wrappers preserve onboarding and settings copy differences', async () => {
        const onboardingCapture = createCapture<ReturnType<typeof useTrackedVerificationActions>>();
        const settingsCapture = createCapture<ReturnType<typeof useTrackedVerificationActions>>();

        function OnboardingHarness({
            onReady,
        }: {
            onReady: (actions: ReturnType<typeof useTrackedVerificationActions>) => void;
        }) {
            onReady(useTrackedVerificationActions('onboarding'));
            return null;
        }

        function SettingsHarness({
            onReady,
        }: {
            onReady: (actions: ReturnType<typeof useTrackedVerificationActions>) => void;
        }) {
            onReady(useTrackedVerificationActions('settings'));
            return null;
        }

        renderToStaticMarkup(
            <>
                <OnboardingHarness onReady={onboardingCapture.set} />
                <SettingsHarness onReady={settingsCapture.set} />
            </>,
        );

        const onboardingActions = onboardingCapture.get();
        const settingsActions = settingsCapture.get();

        await onboardingActions.requestCode({ email: 'pro@example.com' });
        await settingsActions.confirmCode({ token: '123456' });

        expect(requestVerificationCodeMock).toHaveBeenCalledWith('pro@example.com');
        expect(confirmVerificationCodeMock).toHaveBeenCalledWith('123456');

        expect(executeTrackedActionMock).toHaveBeenNthCalledWith(
            1,
            expect.any(Object),
            expect.objectContaining({
                copy: expect.objectContaining({
                    pending: expect.objectContaining({
                        message: 'Requesting a verification code for your corporate email.',
                    }),
                    success: expect.objectContaining({
                        message: 'Check your inbox for the code to finish onboarding.',
                    }),
                }),
            }),
        );

        expect(executeTrackedActionMock).toHaveBeenNthCalledWith(
            2,
            expect.any(Object),
            expect.objectContaining({
                copy: expect.objectContaining({
                    success: expect.objectContaining({
                        title: 'Email verified',
                        message: 'Your corporate email is now verified.',
                    }),
                }),
            }),
        );
    });

    it('admin wrappers preserve refresh semantics and dispute copy defaults', async () => {
        const capture = createCapture<ReturnType<typeof useTrackedAdminActions>>();

        function Harness({ onReady }: { onReady: (actions: ReturnType<typeof useTrackedAdminActions>) => void }) {
            onReady(useTrackedAdminActions());
            return null;
        }

        renderToStaticMarkup(<Harness onReady={capture.set} />);
        const actions = capture.get();

        await actions.resolveDispute({
            disputeId: 'dispute-1',
            action: 'partial_refund',
            resolution: 'Approved partial refund.',
            refundAmountCents: 5000,
        });

        expect(resolveAdminDisputeMock).toHaveBeenCalledWith({
            disputeId: 'dispute-1',
            action: 'partial_refund',
            resolution: 'Approved partial refund.',
            refundAmountCents: 5000,
        });
        expect(executeTrackedActionMock).toHaveBeenCalledWith(
            expect.any(Object),
            expect.objectContaining({
                postSuccess: { kind: 'refresh' },
                copy: expect.objectContaining({
                    pending: expect.objectContaining({ title: 'Resolving dispute' }),
                    success: expect.objectContaining({ message: 'The partial refund has been recorded.' }),
                }),
            }),
        );
    });
});
