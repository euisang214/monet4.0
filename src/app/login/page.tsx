import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
    return (
        <main className="min-h-screen py-12">
            <div className="container">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 items-center">
                    <section className="hidden sm:block">
                        <p className="text-xs uppercase tracking-wider text-blue-600 mb-3">Monet Access</p>
                        <h1 className="text-3xl font-bold text-gray-900 mb-3">Sign in and continue your momentum</h1>
                        <p className="text-gray-600">
                            Manage requests, book sessions, submit feedback, and track payouts from one place.
                        </p>
                    </section>
                    <Suspense fallback={<div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">Loading...</div>}>
                        <LoginForm />
                    </Suspense>
                </div>
            </div>
        </main>
    );
}

