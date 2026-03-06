import { Suspense } from "react";
import { SignupForm } from "@/components/auth/SignupForm";
import { AuthCard, AuthShell } from "@/components/ui/primitives/Auth";

export default function SignupPage() {
    return (
        <AuthShell className="px-4 py-12">
            <div className="w-full max-w-md">
                <Suspense fallback={<AuthCard className="shadow-sm text-center text-sm text-gray-600">Loading...</AuthCard>}>
                    <SignupForm />
                </Suspense>
            </div>
        </AuthShell>
    );
}
