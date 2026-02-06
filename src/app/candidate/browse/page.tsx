import React from 'react';
import { auth } from '@/auth';
import { CandidateBrowse } from '@/lib/role/candidate/browse';
import { ListingCard } from '@/components/browse/ListingCard';
import { redirect } from 'next/navigation';
import { EmptyState } from '@/components/ui/EmptyState';

export const dynamic = 'force-dynamic';

export default async function BrowsePage() {
    const session = await auth();
    if (!session?.user) {
        redirect('/login?callbackUrl=/candidate/browse');
    }

    const professionals = await CandidateBrowse.searchProfessionals();

    return (
        <main className="container py-8">
            <header className="mb-8">
                <p className="text-xs uppercase tracking-wider text-blue-600 mb-2">Candidate Browse</p>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Find a professional to book</h1>
                <p className="text-gray-600">Explore vetted experts and compare focus areas, pricing, and fit.</p>
            </header>

            {professionals.length === 0 ? (
                <EmptyState
                    badge="Directory unavailable"
                    title="No professionals are visible right now"
                    description="Profiles may be temporarily unavailable. Check back soon or review your account setup."
                    actionLabel="Go to dashboard"
                    actionHref="/candidate/dashboard"
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {professionals.map((pro) => (
                        <ListingCard key={pro.userId} professional={pro} />
                    ))}
                </div>
            )}
        </main>
    );
}
