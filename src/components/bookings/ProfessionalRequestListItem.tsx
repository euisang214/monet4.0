import { BookingStatus } from "@prisma/client";
import { appRoutes } from "@/lib/shared/routes";
import { ProfessionalRequestActions } from "@/components/bookings/ProfessionalRequestActions";
import { formatCandidateForProfessionalView } from "@/lib/domain/users/identity-labels";

interface ProfessionalRequestListItemProps {
    booking: {
        id: string;
        status: BookingStatus;
        priceCents: number | null;
        expiresAt: Date | null;
        candidateLabel?: string;
        candidate: {
            firstName?: string | null;
            lastName?: string | null;
            candidateProfile?: {
                resumeUrl?: string | null;
                experience?: Array<{
                    id?: string;
                    title?: string | null;
                    company?: string | null;
                    startDate?: Date | string | null;
                    endDate?: Date | string | null;
                    isCurrent?: boolean | null;
                }>;
                education?: Array<{
                    id?: string;
                    school?: string | null;
                    startDate?: Date | string | null;
                    endDate?: Date | string | null;
                    isCurrent?: boolean | null;
                }>;
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
    const candidateLabel =
        booking.candidateLabel
        || formatCandidateForProfessionalView({
            firstName: booking.candidate.firstName,
            lastName: booking.candidate.lastName,
            experience: booking.candidate.candidateProfile?.experience,
            education: booking.candidate.candidateProfile?.education,
        });

    return (
        <li className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm">
            <div className="flex justify-between items-start">
                <div>
                    <p className="font-semibold text-gray-900 mb-1">{candidateLabel}</p>
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
