import { requireRole } from '@/lib/core/api-helpers';
import Link from 'next/link';
import { BookingStatus, Role } from '@prisma/client';
import {
    type CandidateChatBooking,
    type CandidateChatSection,
    getCandidateChatSectionCounts,
    getCandidateChatSectionPage,
} from '@/lib/role/candidate/chats';
import { appRoutes } from '@/lib/shared/routes';
import { EmptyState } from '@/components/ui/composites/EmptyState';
import { CandidateHistoryActions } from '@/components/bookings/CandidateHistoryActions';

const CHAT_SECTION_KEYS: CandidateChatSection[] = ['upcoming', 'pending', 'expired', 'past', 'other'];
const DEFAULT_VIEW: CandidateChatSection = 'upcoming';

const SECTION_META: Array<{ key: CandidateChatSection; title: string; description: string }> = [
    {
        key: 'upcoming',
        title: 'Upcoming',
        description: 'Accepted conversations that have a scheduled or near-term session window.',
    },
    {
        key: 'pending',
        title: 'Pending',
        description: 'Requests still in progress and waiting for acceptance, rescheduling, or dispute handling.',
    },
    {
        key: 'expired',
        title: 'Expired',
        description: 'Requests that timed out before the booking could be finalized.',
    },
    {
        key: 'past',
        title: 'Past',
        description: 'Closed conversations including completed, cancelled, declined, and refunded bookings.',
    },
    {
        key: 'other',
        title: 'Other',
        description: 'Any booking statuses outside the standard workflow buckets.',
    },
];

function isChatSection(view: string | undefined): view is CandidateChatSection {
    if (!view) return false;
    return CHAT_SECTION_KEYS.includes(view as CandidateChatSection);
}

function toStatusLabel(status: BookingStatus) {
    return status.replace(/_/g, ' ');
}

function statusTone(status: BookingStatus) {
    if (status === 'completed' || status === 'accepted' || status === 'accepted_pending_integrations') {
        return 'bg-green-50 text-green-700';
    }

    if (status === 'cancelled' || status === 'declined' || status === 'refunded' || status === 'expired') {
        return 'bg-red-50 text-red-700';
    }

    if (status === 'requested' || status === 'reschedule_pending' || status === 'dispute_pending' || status === 'draft') {
        return 'bg-yellow-50 text-yellow-700';
    }

    return 'bg-gray-100 text-gray-700';
}

function scheduleLabel(booking: CandidateChatBooking) {
    if (booking.startAt) {
        return `${booking.startAt.toLocaleDateString()} at ${booking.startAt.toLocaleTimeString()} (${booking.timezone})`;
    }

    if (booking.expiresAt) {
        return `Request window ends ${booking.expiresAt.toLocaleDateString()} at ${booking.expiresAt.toLocaleTimeString()} (${booking.timezone})`;
    }

    return `Awaiting scheduling details (${booking.timezone})`;
}

function sectionUrl(view: CandidateChatSection, cursor?: string) {
    const params = new URLSearchParams();
    params.set('view', view);
    if (cursor) {
        params.set('cursor', cursor);
    }
    return `${appRoutes.candidate.chats}?${params.toString()}`;
}

export default async function CandidateChatsPage({
    searchParams,
}: {
    searchParams?:
        | {
              view?: string;
              cursor?: string;
          }
        | Promise<{
              view?: string;
              cursor?: string;
          }>;
}) {
    const user = await requireRole(Role.CANDIDATE, appRoutes.candidate.chats);
    const resolvedSearchParams = (await searchParams) ?? {};
    const activeView = isChatSection(resolvedSearchParams.view) ? resolvedSearchParams.view : DEFAULT_VIEW;
    const cursor = resolvedSearchParams.cursor;

    const [sectionCounts, sectionPage] = await Promise.all([
        getCandidateChatSectionCounts(user.id),
        getCandidateChatSectionPage(user.id, activeView, { cursor }),
    ]);

    console.info('[perf][candidate-history] pageData', {
        view: activeView,
        hasCursor: Boolean(cursor),
        rows: sectionPage.items.length,
    });

    const sections = SECTION_META.map((section) => ({
        ...section,
        count: sectionCounts[section.key],
    }));
    const activeSection = sections.find((section) => section.key === activeView) ?? sections[0];
    const totalChats = sections.reduce((total, section) => total + section.count, 0);

    return (
        <main className="container py-8">
            <header className="mb-8">
                <p className="text-xs uppercase tracking-wider text-blue-600 mb-2">Candidate Chats</p>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">All conversation threads by booking status</h1>
                <p className="text-gray-600">
                    Track upcoming, pending, expired, and past conversations in a single focused view.
                </p>
            </header>

            {totalChats === 0 ? (
                <EmptyState
                    badge="No chats yet"
                    title="No conversations found"
                    description="Book your first consultation and your conversation history will populate here."
                    actionLabel="Browse professionals"
                    actionHref={appRoutes.candidate.browse}
                />
            ) : (
                <div className="space-y-6">
                    <nav className="flex flex-wrap gap-2" aria-label="Conversation sections">
                        {sections.map((section) => {
                            const isActive = section.key === activeView;
                            return (
                                <Link
                                    key={section.key}
                                    href={sectionUrl(section.key)}
                                    className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${isActive
                                            ? 'border-blue-600 bg-blue-600 text-white'
                                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                                        }`}
                                >
                                    {section.title} ({section.count})
                                </Link>
                            );
                        })}
                    </nav>

                    <section>
                        <div className="mb-4 flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-xl font-semibold text-gray-900">{activeSection.title}</h2>
                                <p className="text-sm text-gray-600 mt-1">{activeSection.description}</p>
                            </div>
                            <span className="px-2 py-1 text-xs rounded-full font-semibold bg-gray-100 text-gray-700">
                                {activeSection.count}
                            </span>
                        </div>

                        {sectionPage.items.length === 0 ? (
                            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500">
                                No conversations in this status bucket.
                            </div>
                        ) : (
                            <ul className="space-y-4">
                                {sectionPage.items.map((booking) => (
                                    <li key={booking.id} className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm">
                                        <div className="flex justify-between items-start gap-4">
                                            <div>
                                                <p className="font-semibold text-gray-900 mb-1">
                                                    {booking.professional.email}
                                                </p>
                                                {booking.professional.professionalProfile?.title && (
                                                    <p className="text-xs text-gray-500 mb-2">
                                                        {booking.professional.professionalProfile.title}
                                                        {booking.professional.professionalProfile.employer
                                                            ? ` at ${booking.professional.professionalProfile.employer}`
                                                            : ''}
                                                    </p>
                                                )}
                                                <p className="text-sm text-gray-600">
                                                    {scheduleLabel(booking)}
                                                </p>
                                            </div>
                                            <span className={`px-2 py-1 text-xs rounded-full font-semibold ${statusTone(booking.status)}`}>
                                                {toStatusLabel(booking.status)}
                                            </span>
                                        </div>

                                        <div className="mt-3">
                                            {booking.status === BookingStatus.completed ? (
                                                booking.feedback ? (
                                                    <p className="text-sm text-gray-500">
                                                        Feedback submitted and available in booking details.
                                                    </p>
                                                ) : (
                                                    <p className="text-sm text-gray-500">
                                                        Feedback is not available yet for this completed booking.
                                                    </p>
                                                )
                                            ) : (
                                                <p className="text-sm text-gray-500">
                                                    Use the actions below to manage this booking.
                                                </p>
                                            )}

                                            <CandidateHistoryActions
                                                bookingId={booking.id}
                                                status={booking.status}
                                                joinUrl={booking.candidateZoomJoinUrl || booking.zoomJoinUrl}
                                                hasFeedback={Boolean(booking.feedback)}
                                            />
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    <div className="flex items-center gap-3">
                        {cursor ? (
                            <Link
                                href={sectionUrl(activeView)}
                                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                            >
                                Back to first page
                            </Link>
                        ) : null}
                        {sectionPage.nextCursor ? (
                            <Link
                                href={sectionUrl(activeView, sectionPage.nextCursor)}
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
