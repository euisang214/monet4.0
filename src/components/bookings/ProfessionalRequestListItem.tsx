import { BookingStatus } from "@prisma/client";
import { appRoutes } from "@/lib/shared/routes";
import { ProfessionalRequestActions } from "@/components/bookings/ProfessionalRequestActions";

interface ProfessionalRequestListItemProps {
    booking: {
        id: string;
        status: BookingStatus;
        priceCents: number | null;
        expiresAt: Date | null;
        candidate: {
            email: string;
            candidateProfile?: {
                resumeUrl?: string | null;
            } | null;
        };
    };
}

export function ProfessionalRequestListItem({ booking }: ProfessionalRequestListItemProps) {
    const isReschedule = booking.status === BookingStatus.reschedule_pending;
    const badgeText = isReschedule ? "Reschedule" : "Pending";
    const badgeClass = isReschedule ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700";
    const href = isReschedule
        ? appRoutes.professional.requestReschedule(booking.id)
        : appRoutes.professional.requestConfirmAndSchedule(booking.id);
    const buttonText = isReschedule ? "Review reschedule" : "Review & schedule";

    return (
        <li className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm">
            <div className="flex justify-between items-start">
                <div>
                    <p className="font-semibold text-gray-900 mb-1">{booking.candidate.email}</p>
                    <p className="text-sm text-gray-600">${((booking.priceCents || 0) / 100).toFixed(2)}</p>
                </div>
                <div className="text-right">
                    <span className={`px-2 py-1 text-xs rounded-full font-semibold ${badgeClass}`}>
                        {badgeText}
                    </span>
                    {isReschedule ? (
                        <p className="text-xs text-gray-500 mt-1">Awaiting time selection</p>
                    ) : (
                        <p className="text-xs text-gray-500 mt-1">
                            Expires: {booking.expiresAt?.toLocaleDateString()}
                        </p>
                    )}
                </div>
            </div>

            <ProfessionalRequestActions
                bookingId={booking.id}
                reviewHref={href}
                reviewLabel={buttonText}
                resumeUrl={booking.candidate.candidateProfile?.resumeUrl}
                isReschedule={isReschedule}
            />
        </li>
    );
}
