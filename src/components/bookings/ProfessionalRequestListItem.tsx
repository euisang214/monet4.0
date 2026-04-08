import { BookingStatus } from "@prisma/client";
import { appRoutes } from "@/lib/shared/routes";
import { ProfessionalRequestActions } from "@/components/bookings/ProfessionalRequestActions";
import { formatCandidateForProfessionalView } from "@/lib/domain/users/identity-labels";
import { StatusBadge, SurfaceCard } from "@/components/ui";

interface ProfessionalRequestListItemProps {
    booking: {
        id: string;
        status: BookingStatus;
        rescheduleAwaitingParty?: "CANDIDATE" | "PROFESSIONAL" | null;
        priceCents: number | null;
        expiresAt: Date | null;
        candidateLabel?: string;
        resumeHref?: string | null;
        candidate?: {
            firstName?: string | null;
            lastName?: string | null;
            candidateProfile?: {
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
    const href = isReschedule
        ? appRoutes.professional.requestReschedule(booking.id)
        : appRoutes.professional.requestConfirmAndSchedule(booking.id);
    const buttonText = isReschedule
        ? booking.rescheduleAwaitingParty === "CANDIDATE"
            ? "View proposal round"
            : "Review reschedule"
        : "Review & schedule";
    const candidateLabel =
        booking.candidateLabel
        || formatCandidateForProfessionalView({
            firstName: booking.candidate?.firstName,
            lastName: booking.candidate?.lastName,
            experience: booking.candidate?.candidateProfile?.experience,
            education: booking.candidate?.candidateProfile?.education,
        });

    return (
        <SurfaceCard as="li" className="p-5">
            <div className="flex justify-between items-start">
                <div>
                    <p className="font-semibold text-gray-900 mb-1">{candidateLabel}</p>
                    <p className="text-sm text-gray-600">${((booking.priceCents || 0) / 100).toFixed(2)}</p>
                </div>
                <div className="text-right">
                    <StatusBadge label={badgeText} variant={isReschedule ? "info" : "warning"} />
                    {isReschedule ? (
                        <p className="text-xs text-gray-500 mt-1">
                            {booking.rescheduleAwaitingParty === "CANDIDATE"
                                ? "Awaiting candidate response"
                                : "Awaiting your response"}
                        </p>
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
                resumeHref={booking.resumeHref}
                isReschedule={isReschedule}
            />
        </SurfaceCard>
    );
}
