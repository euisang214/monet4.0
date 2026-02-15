import { requireRole } from '@/lib/core/api-helpers';
import Link from 'next/link';
import { BookingStatus, Role } from '@prisma/client';
import { getCandidateChats } from '@/lib/role/candidate/chats';
import { appRoutes } from '@/lib/shared/routes';
import { EmptyState } from '@/components/ui/composites/EmptyState';

type ChatSectionKey = 'upcoming' | 'pending' | 'expired' | 'past' | 'other';
type CandidateChatBooking = Awaited<ReturnType<typeof getCandidateChats>>[number];

const STATUS_TO_SECTION: Partial<Record<BookingStatus, ChatSectionKey>> = {
    accepted: 'upcoming',
    accepted_pending_integrations: 'upcoming',
    draft: 'pending',
    requested: 'pending',
    reschedule_pending: 'pending',
    dispute_pending: 'pending',
    expired: 'expired',
    completed: 'past',
    completed_pending_feedback: 'past',
    cancelled: 'past',
    declined: 'past',
    refunded: 'past',
};

const SECTION_META: Array<{ key: ChatSectionKey; title: string; description: string }> = [
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

function getSection(status: BookingStatus): ChatSectionKey {
    return STATUS_TO_SECTION[status] ?? 'other';
}

function dateValue(date: Date | null | undefined, fallback: number) {
    return date ? date.getTime() : fallback;
}

function compareAscWithNullsLast(
    aDate: Date | null | undefined,
    bDate: Date | null | undefined,
    aId: string,
    bId: string,
) {
    const a = dateValue(aDate, Number.MAX_SAFE_INTEGER);
    const b = dateValue(bDate, Number.MAX_SAFE_INTEGER);

    if (a === b) {
        return bId.localeCompare(aId);
    }

    return a - b;
}

function compareDescWithNullsLast(
    aDate: Date | null | undefined,
    bDate: Date | null | undefined,
    aId: string,
    bId: string,
) {
    const a = dateValue(aDate, Number.MIN_SAFE_INTEGER);
    const b = dateValue(bDate, Number.MIN_SAFE_INTEGER);

    if (a === b) {
        return bId.localeCompare(aId);
    }

    return b - a;
}

function sortSectionBookings(section: ChatSectionKey, bookings: CandidateChatBooking[]) {
    return [...bookings].sort((a, b) => {
        if (section === 'upcoming') {
            return compareAscWithNullsLast(
                a.startAt ?? a.expiresAt,
                b.startAt ?? b.expiresAt,
                a.id,
                b.id,
            );
        }

        if (section === 'pending') {
            return compareAscWithNullsLast(
                a.expiresAt ?? a.startAt,
                b.expiresAt ?? b.startAt,
                a.id,
                b.id,
            );
        }

        return compareDescWithNullsLast(
            a.endAt ?? a.startAt ?? a.expiresAt,
            b.endAt ?? b.startAt ?? b.expiresAt,
            a.id,
            b.id,
        );
    });
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

export default async function CandidateChatsPage() {
    const user = await requireRole(Role.CANDIDATE, appRoutes.candidate.chats);

    const bookings = await getCandidateChats(user.id);

    const groupedBookings: Record<ChatSectionKey, CandidateChatBooking[]> = {
        upcoming: [],
        pending: [],
        expired: [],
        past: [],
        other: [],
    };

    for (const booking of bookings) {
        groupedBookings[getSection(booking.status)].push(booking);
    }

    const sections = SECTION_META.map((section) => ({
        ...section,
        bookings: sortSectionBookings(section.key, groupedBookings[section.key]),
    }));

    return (
        <main className="container py-8">
            <header className="mb-8">
                <p className="text-xs uppercase tracking-wider text-blue-600 mb-2">Candidate Chats</p>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">All conversation threads by booking status</h1>
                <p className="text-gray-600">
                    Track upcoming, pending, expired, and past conversations in a single unified view.
                </p>
            </header>

            {bookings.length === 0 ? (
                <EmptyState
                    badge="No chats yet"
                    title="No conversations found"
                    description="Book your first consultation and your conversation history will populate here."
                    actionLabel="Browse professionals"
                    actionHref={appRoutes.candidate.browse}
                />
            ) : (
                <div className="space-y-10">
                    {sections.map((section) => (
                        <section key={section.key}>
                            <div className="mb-4 flex items-start justify-between gap-4">
                                <div>
                                    <h2 className="text-xl font-semibold text-gray-900">{section.title}</h2>
                                    <p className="text-sm text-gray-600 mt-1">{section.description}</p>
                                </div>
                                <span className="px-2 py-1 text-xs rounded-full font-semibold bg-gray-100 text-gray-700">
                                    {section.bookings.length}
                                </span>
                            </div>

                            {section.bookings.length === 0 ? (
                                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500">
                                    No conversations in this status bucket.
                                </div>
                            ) : (
                                <ul className="space-y-4">
                                    {section.bookings.map((booking) => (
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

                                            <div className="mt-3 flex items-center justify-between gap-3">
                                                {booking.feedback ? (
                                                    <p className="text-sm text-gray-500">
                                                        Feedback submitted and attached to this booking.
                                                    </p>
                                                ) : (
                                                    <p className="text-sm text-gray-500">
                                                        No feedback submitted for this conversation yet.
                                                    </p>
                                                )}

                                                <Link
                                                    href={appRoutes.candidate.bookingDetails(booking.id)}
                                                    className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                                                >
                                                    Open chat
                                                </Link>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    ))}
                </div>
            )}
        </main>
    );
}
