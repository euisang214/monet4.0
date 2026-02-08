import { Suspense } from "react";
import { SignupForm } from "@/components/auth/SignupForm";

export default function SignupPage() {
    return (
        <main className="min-h-screen flex items-center justify-center">
            <div className="w-full max-w-md">
                <Suspense fallback={<div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">Loading...</div>}>
                    <SignupForm />
                </Suspense>
            </div>
        </main>
    );
}
