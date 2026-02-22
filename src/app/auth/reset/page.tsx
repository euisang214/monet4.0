'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { appRoutes } from '@/lib/shared/routes';

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
                    <section className="max-w-md mx-auto bg-white p-8 rounded-xl border border-gray-200 shadow-lg text-center">
                        <p className="text-xs uppercase tracking-wider text-red-600 mb-3">Reset Link Issue</p>
                        <h1 className="text-2xl font-bold text-gray-900 mb-3">Invalid or missing token</h1>
                        <p className="text-sm text-gray-600 mb-6">
                            The reset link is incomplete or expired. Request a new one to continue.
                        </p>
                        <Link href="/forgot-password" className="btn bg-blue-600 text-white hover:bg-blue-700">
                            Request new reset link
                        </Link>
                    </section>
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
                    <section className="max-w-md mx-auto bg-white p-8 rounded-xl border border-gray-200 shadow-lg text-center">
                        <p className="text-xs uppercase tracking-wider text-green-600 mb-3">Password Updated</p>
                        <h1 className="text-2xl font-bold text-gray-900 mb-3">Reset successful</h1>
                        <p className="text-sm text-gray-600 mb-6">
                            Your password has been changed. Redirecting you to login now.
                        </p>
                        <Link href="/login" className="btn bg-black text-white hover:bg-gray-800">
                            Go to login
                        </Link>
                    </section>
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

                    <section className="w-full max-w-md bg-white p-8 rounded-xl border border-gray-200 shadow-lg space-y-6">
                        <header className="text-center">
                            <p className="text-xs uppercase tracking-wider text-blue-600 mb-2">Password Reset</p>
                            <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Set a new password</h2>
                            <p className="text-sm text-gray-600">Enter and confirm your new password below.</p>
                        </header>

                        {errorMessage && (
                            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-md">
                                {errorMessage}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="-space-y-px rounded-md shadow-sm">
                                <div>
                                    <label htmlFor="password" className="sr-only">New Password</label>
                                    <input
                                        id="password"
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="relative block w-full appearance-none rounded-none rounded-t-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-black focus:outline-none focus:ring-black sm:text-sm"
                                        placeholder="New password"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="confirm" className="sr-only">Confirm Password</label>
                                    <input
                                        id="confirm"
                                        type="password"
                                        required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="relative block w-full appearance-none rounded-none rounded-b-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-black focus:outline-none focus:ring-black sm:text-sm"
                                        placeholder="Confirm password"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={status === 'loading'}
                                className="w-full py-2 px-4 bg-black text-white rounded-md hover:bg-gray-800 disabled:opacity-50"
                            >
                                {status === 'loading' ? 'Resetting...' : 'Reset password'}
                            </button>
                        </form>
                    </section>
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
