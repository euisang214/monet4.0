import { Suspense } from "react";
import { LandingPageClient } from "@/components/landing/LandingPageClient";

export default function LandingPage() {
    return (
        <Suspense fallback={<div className="container py-12 text-center text-gray-600">Loading...</div>}>
            <LandingPageClient />
        </Suspense>
    );
}
