'use client';

import { useRouter } from 'next/navigation';
import { confirmVerificationCode, requestVerificationCode } from '@/components/auth/services/verificationApi';
import type { ActionToastOverride } from '@/components/ui/actions/executeTrackedAction';
import { executeTrackedAction } from '@/components/ui/actions/executeTrackedAction';
import { buildErrorToastCopy } from '@/components/ui/hooks/requestToastController';
import { useTrackedRequest } from '@/components/ui/providers/RequestToastProvider';

type VerificationContext = 'onboarding' | 'settings';

interface RequestCodeArgs {
    email: string;
    toast?: ActionToastOverride<void>;
}

interface ConfirmCodeArgs {
    token: string;
    toast?: ActionToastOverride<void>;
}

export function useTrackedVerificationActions(context: VerificationContext) {
    const router = useRouter();
    const { runTrackedRequest } = useTrackedRequest();
    const runtime = {
        runTrackedRequest,
        push: router.push,
        replace: router.replace,
        refresh: router.refresh,
    };

    const requestCode = async ({ email, toast }: RequestCodeArgs) =>
        executeTrackedAction(runtime, {
            action: async () => {
                await requestVerificationCode(email);
            },
            copy: {
                pending: {
                    title: 'Sending verification email',
                    message: context === 'onboarding'
                        ? 'Requesting a verification code for your corporate email.'
                        : 'Requesting a verification code for your corporate inbox.',
                },
                success: {
                    title: 'Verification email sent',
                    message: context === 'onboarding'
                        ? 'Check your inbox for the code to finish onboarding.'
                        : 'Check your inbox for the verification code.',
                },
                error: (error) => buildErrorToastCopy(error, 'Verification email failed', 'Failed to send verification email.'),
            },
            toast,
            postSuccess: { kind: 'none' },
        });

    const confirmCode = async ({ token, toast }: ConfirmCodeArgs) =>
        executeTrackedAction(runtime, {
            action: async () => {
                await confirmVerificationCode(token);
            },
            copy: {
                pending: {
                    title: 'Confirming verification',
                    message: 'Checking your verification code.',
                },
                success: {
                    title: context === 'onboarding' ? 'Corporate email verified' : 'Email verified',
                    message: context === 'onboarding'
                        ? 'Your profile can now complete onboarding.'
                        : 'Your corporate email is now verified.',
                },
                error: (error) => buildErrorToastCopy(error, 'Verification failed', 'Verification code is invalid or expired.'),
            },
            toast,
            postSuccess: { kind: 'none' },
        });

    return {
        requestCode,
        confirmCode,
    };
}
