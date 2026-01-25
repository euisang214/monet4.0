import React from 'react';
import { auth } from '@/auth';
import { CandidateBrowse } from '@/lib/role/candidate/browse';
import { ListingCard } from '@/components/browse/ListingCard';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function BrowsePage() {
    const session = await auth();
    if (!session?.user) {
        redirect('/auth/signin?callbackUrl=/candidate/browse');
    }

    const professionals = await CandidateBrowse.searchProfessionals();

    return (
        <div className="container mx-auto py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Find a Professional</h1>
                <p className="text-gray-600">Browse our curated list of experts available for consultation.</p>
            </div>

            {professionals.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">No professionals found at the moment.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {professionals.map((pro) => (
                        <ListingCard key={pro.userId} professional={pro} />
                    ))}
                </div>
            )}
        </div>
    );
}
