import { appRoutes } from '@/lib/shared/routes';

interface ApiErrorResponse {
    error?: string;
}

export async function requestVerificationCode(email: string) {
    const response = await fetch(appRoutes.api.shared.verificationRequest, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
    });

    if (response.ok) {
        return;
    }

    throw new Error('Failed to send verification email.');
}

export async function confirmVerificationCode(token: string) {
    const response = await fetch(appRoutes.api.shared.verificationConfirm, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
    });

    const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    if (!response.ok) {
        throw new Error(payload?.error || 'Verification code is invalid or expired.');
    }
}
