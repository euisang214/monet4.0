import { Suspense } from "react";
import { SignupForm } from "@/components/auth/SignupForm";

export default function SignupPage() {
    return (
        <main className="min-h-screen py-12">
            <div className="container">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 items-center">
                    <section className="hidden sm:block">
                        <p className="text-xs uppercase tracking-wider text-blue-600 mb-3">Create Account</p>
                        <h1 className="text-3xl font-bold text-gray-900 mb-3">Start booking or mentoring in minutes</h1>
                        <p className="text-gray-600">
                            Pick your role, complete signup, and access the role-specific workflow immediately.
                        </p>
                    </section>
                    <Suspense fallback={<div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">Loading...</div>}>
                        <SignupForm />
                    </Suspense>
                </div>
            </div>
        </main>
    );
}

