import { notFound } from 'next/navigation';
import { prisma } from '@/lib/core/db';
import { format } from 'date-fns';
import Link from 'next/link';
import { ZoomLinkForm } from './ZoomLinkForm';
import { AttendanceEvidenceCard } from '@/components/admin/AttendanceEvidenceCard';

export default async function BookingDetailPage(props: {
    params: Promise<{ id: string }>;
}) {
    const params = await props.params;
    const booking = await prisma.booking.findUnique({
        where: { id: params.id },
        include: {
            candidate: { select: { email: true, id: true } },
            professional: { select: { email: true, id: true, professionalProfile: { select: { title: true, employer: true } } } },
            payment: true,
            payout: true,
            dispute: true,
        },
    });

    if (!booking) {
        notFound();
    }

    const [attendanceEvents, latestNoShowAudit] = await Promise.all([
        prisma.zoomAttendanceEvent.findMany({
            where: { bookingId: booking.id },
            orderBy: { eventTs: 'desc' },
            take: 20,
        }),
        prisma.auditLog.findFirst({
            where: {
                entity: 'Booking',
                entityId: booking.id,
                action: 'attendance:no_show_decision',
            },
            orderBy: { createdAt: 'desc' },
        }),
    ]);

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex items-center gap-4">
                <Link href="/admin/bookings" className="text-gray-500 hover:text-gray-700">
                    ← Back to Bookings
                </Link>
                <h1 className="text-2xl font-bold text-gray-800">Booking Details</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Core Details */}
                <div className="bg-white shadow rounded-lg p-6 space-y-4">
                    <h2 className="text-lg font-semibold border-b pb-2">Overview</h2>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="block text-gray-500">ID</span>
                            <span className="font-mono">{booking.id}</span>
                        </div>
                        <div>
                            <span className="block text-gray-500">Status</span>
                            <span className="font-medium">{booking.status}</span>
                        </div>
                        <div>
                            <span className="block text-gray-500">Price</span>
                            <span>{booking.priceCents ? `$${(booking.priceCents / 100).toFixed(2)}` : '-'}</span>
                        </div>
                    </div>
                </div>

                {/* Schedule */}
                <div className="bg-white shadow rounded-lg p-6 space-y-4">
                    <h2 className="text-lg font-semibold border-b pb-2">Schedule & Zoom</h2>
                    <div className="grid grid-cols-1 gap-4 text-sm">
                        <div>
                            <span className="block text-gray-500">Start Time</span>
                            <span>{booking.startAt ? format(booking.startAt, 'PPpp') : 'Not scheduled'}</span>
                        </div>
                        <div>
                            <span className="block text-gray-500">Current Zoom URL</span>
                            <a href={booking.zoomJoinUrl || '#'} target="_blank" className="text-blue-600 truncate block">
                                {booking.zoomJoinUrl || 'None'}
                            </a>
                        </div>
                        <div>
                            <span className="block text-gray-500">Candidate Zoom URL</span>
                            <a href={booking.candidateZoomJoinUrl || '#'} target="_blank" className="text-blue-600 truncate block">
                                {booking.candidateZoomJoinUrl || 'None'}
                            </a>
                        </div>
                        <div>
                            <span className="block text-gray-500">Professional Zoom URL</span>
                            <a href={booking.professionalZoomJoinUrl || '#'} target="_blank" className="text-blue-600 truncate block">
                                {booking.professionalZoomJoinUrl || 'None'}
                            </a>
                        </div>
                    </div>

                    <div className="mt-4 pt-4 border-t">
                        <ZoomLinkForm
                            bookingId={booking.id}
                            initialUrl={booking.zoomJoinUrl}
                            initialMeetingId={booking.zoomMeetingId}
                            initialCandidateUrl={booking.candidateZoomJoinUrl}
                            initialProfessionalUrl={booking.professionalZoomJoinUrl}
                        />
                    </div>
                </div>

                {/* Entities */}
                <div className="bg-white shadow rounded-lg p-6 space-y-4">
                    <h2 className="text-lg font-semibold border-b pb-2">Participants</h2>
                    <div className="space-y-3 text-sm">
                        <div>
                            <span className="block text-gray-500">Candidate</span>
                            <div className="font-medium">{booking.candidate.email}</div>
                            <div className="text-xs text-gray-400">{booking.candidate.id}</div>
                        </div>
                        <div>
                            <span className="block text-gray-500">Professional</span>
                            <div className="font-medium">{booking.professional.email}</div>
                            <div className="text-gray-600">{booking.professional.professionalProfile?.title} @ {booking.professional.professionalProfile?.employer}</div>
                            <div className="text-xs text-gray-400">{booking.professional.id}</div>
                        </div>
                    </div>
                </div>

                {/* Financials */}
                <div className="bg-white shadow rounded-lg p-6 space-y-4">
                    <h2 className="text-lg font-semibold border-b pb-2">Financials</h2>
                    <div className="space-y-3 text-sm">
                        {booking.payment ? (
                            <div>
                                <span className="block text-gray-500">Payment Status</span>
                                <span className="font-medium">{booking.payment.status}</span>
                                <div className="text-xs text-gray-400">Intent: {booking.payment.stripePaymentIntentId}</div>
                            </div>
                        ) : (
                            <div className="text-yellow-600">No payment record</div>
                        )}

                        {booking.payout ? (
                            <div>
                                <span className="block text-gray-500">Payout Status</span>
                                <span className="font-medium">{booking.payout.status}</span>
                            </div>
                        ) : (
                            <div className="text-gray-400">No payout record</div>
                        )}
                    </div>
                </div>
            </div>

            <AttendanceEvidenceCard
                candidateJoinedAt={booking.candidateJoinedAt}
                professionalJoinedAt={booking.professionalJoinedAt}
                attendanceOutcome={booking.attendanceOutcome}
                events={attendanceEvents}
                latestNoShowAudit={latestNoShowAudit}
            />
        </div>
    );
}
