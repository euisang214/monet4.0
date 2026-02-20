import React from 'react';
import Link from 'next/link';
import { auth } from '@/auth';
import { CandidateBrowse } from '@/lib/role/candidate/browse';
import { ListingCard } from '@/components/browse/ListingCard';
import { redirect } from 'next/navigation';
import { EmptyState } from '@/components/ui/composites/EmptyState';
import { appRoutes } from '@/lib/shared/routes';

export const revalidate = 60;

function browsePageUrl(cursor?: string) {
    if (!cursor) {
        return appRoutes.candidate.browse;
    }

    const params = new URLSearchParams();
    params.set('cursor', cursor);
    return `${appRoutes.candidate.browse}?${params.toString()}`;
}

export default async function BrowsePage({
    searchParams,
}: {
    searchParams?: {
        cursor?: string;
    };
}) {
    const session = await auth();
    if (!session?.user) {
        redirect('/login?callbackUrl=/candidate/browse');
    }

    const startedAt = performance.now();
    const { items: professionals, nextCursor } = await CandidateBrowse.searchProfessionals({
        cursor: searchParams?.cursor,
    });
    const durationMs = Number((performance.now() - startedAt).toFixed(2));

    console.info('[perf][candidate-browse] pageData', {
        hasCursor: Boolean(searchParams?.cursor),
        rows: professionals.length,
        durationMs,
    });

    return (
        <main className="container py-8">
            <header className="mb-8">
                <p className="text-xs uppercase tracking-wider text-blue-600 mb-2">Browse Professionals</p>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Find Your Next Career Mentor</h1>
                <p className="text-gray-600">Connect with vetted experts and top professionals from leading companies</p>
            </header>

            {professionals.length === 0 ? (
                <EmptyState
                    badge="Directory unavailable"
                    title="No professionals are visible right now"
                    description="Profiles may be temporarily unavailable. Check back soon or review your account setup."
                    actionLabel="Go to chats"
                    actionHref={appRoutes.candidate.chats}
                />
            ) : (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {professionals.map((pro) => (
                            <ListingCard key={pro.userId} professional={pro} />
                        ))}
                    </div>

                    <div className="flex items-center gap-3">
                        {searchParams?.cursor ? (
                            <Link
                                href={browsePageUrl()}
                                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                            >
                                Back to first page
                            </Link>
                        ) : null}
                        {nextCursor ? (
                            <Link
                                href={browsePageUrl(nextCursor)}
                                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                            >
                                Older
                            </Link>
                        ) : null}
                    </div>
                </div>
            )}
        </main>
    );
}
