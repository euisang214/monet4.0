'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { appRoutes } from '@/lib/shared/routes';
import { AuthCard, AuthField, AuthMessage } from '@/components/ui/primitives/Auth';
import { Button, buttonVariants } from '@/components/ui/primitives/Button';

type ResetStatus = 'idle' | 'loading' | 'success' | 'error';

function ResetPasswordForm() {
    const searchParams = useSearchParams();
    const token = searchParams.get('token');
    const router = useRouter();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [status, setStatus] = useState<ResetStatus>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    if (!token) {
        return (
            <main className="min-h-screen py-12">
                <div className="container">
                    <AuthCard className="max-w-md text-center">
                        <p className="text-xs uppercase tracking-wider text-red-600 mb-3">Reset Link Issue</p>
                        <h1 className="text-2xl font-bold text-gray-900 mb-3">Invalid or missing token</h1>
                        <p className="text-sm text-gray-600 mb-6">
                            The reset link is incomplete or expired. Request a new one to continue.
                        </p>
                        <Link href="/forgot-password" className={buttonVariants({ variant: 'primary' })}>
                            Request new reset link
                        </Link>
                    </AuthCard>
                </div>
            </main>
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            setErrorMessage('Passwords do not match');
            return;
        }

        if (password.length < 8) {
            setErrorMessage('Password must be at least 8 characters');
            return;
        }

        setStatus('loading');
        setErrorMessage('');

        try {
            const res = await fetch(appRoutes.api.auth.resetPassword, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to reset password');
            }

            setStatus('success');
            setTimeout(() => {
                router.push('/login');
            }, 2500);
        } catch (error: unknown) {
            setStatus('error');
            if (error instanceof Error && error.message === 'invalid_token') {
                setErrorMessage('This link is invalid or has expired.');
            } else {
                setErrorMessage('An error occurred. Please try again.');
            }
        }
    };

    if (status === 'success') {
        return (
            <main className="min-h-screen py-12">
                <div className="container">
                    <AuthCard className="max-w-md text-center">
                        <p className="text-xs uppercase tracking-wider text-green-600 mb-3">Password Updated</p>
                        <h1 className="text-2xl font-bold text-gray-900 mb-3">Reset successful</h1>
                        <p className="text-sm text-gray-600 mb-6">
                            Your password has been changed. Redirecting you to login now.
                        </p>
                        <Link href="/login" className={buttonVariants({ variant: 'primary' })}>
                            Go to login
                        </Link>
                    </AuthCard>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen py-12">
            <div className="container">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 items-center">
                    <section className="hidden sm:block">
                        <p className="text-xs uppercase tracking-wider text-blue-600 mb-3">Reset Credentials</p>
                        <h1 className="text-3xl font-bold text-gray-900 mb-3">Create a new secure password</h1>
                        <p className="text-gray-600">
                            Use at least 8 characters and avoid reusing an old password.
                        </p>
                    </section>

                    <AuthCard>
                        <header className="text-center">
                            <p className="text-xs uppercase tracking-wider text-blue-600 mb-2">Password Reset</p>
                            <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Set a new password</h2>
                            <p className="text-sm text-gray-600">Enter and confirm your new password below.</p>
                        </header>

                        {errorMessage && (
                            <AuthMessage tone="error">{errorMessage}</AuthMessage>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-3">
                                <AuthField
                                    id="password"
                                    name="password"
                                    label="New Password"
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="New password"
                                />
                                <AuthField
                                    id="confirm"
                                    name="confirm"
                                    label="Confirm Password"
                                    type="password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm password"
                                />
                            </div>

                            <Button
                                type="submit"
                                disabled={status === 'loading'}
                                className="w-full justify-center"
                            >
                                {status === 'loading' ? 'Resetting...' : 'Reset password'}
                            </Button>
                        </form>
                    </AuthCard>
                </div>
            </div>
        </main>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<div className="container py-12 text-center text-gray-600">Loading...</div>}>
            <ResetPasswordForm />
        </Suspense>
    );
}
