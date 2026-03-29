import React from 'react';
import Link from 'next/link';
import { auth } from '@/auth';
import { CandidateBrowse } from '@/lib/role/candidate/browse';
import { ListingCard } from '@/components/browse/ListingCard';
import { redirect } from 'next/navigation';
import { EmptyState, PageHeader } from '@/components/ui';
import { appRoutes } from '@/lib/shared/routes';
import { buttonVariants } from '@/components/ui/primitives/Button';

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
        <main className="space-y-8">
            <PageHeader
                eyebrow="Browse professionals"
                title="Find your next career mentor"
                description="Connect with vetted experts and top professionals from leading companies."
            />

            {professionals.length === 0 ? (
                <EmptyState
                    badge="Directory unavailable"
                    title="No professionals are visible right now"
                    description="Profiles may be temporarily unavailable. Check back soon or review your account setup."
                    actionLabel="Go to chats"
                    actionHref={appRoutes.candidate.chats}
                    layout="inline"
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
                                className={buttonVariants({ variant: 'secondary' })}
                            >
                                Back to first page
                            </Link>
                        ) : null}
                        {nextCursor ? (
                            <Link
                                href={browsePageUrl(nextCursor)}
                                className={buttonVariants({ variant: 'secondary' })}
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
