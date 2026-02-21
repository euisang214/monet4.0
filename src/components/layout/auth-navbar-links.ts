import { appRoutes } from "@/lib/shared/routes";

export type UserRole = "CANDIDATE" | "PROFESSIONAL" | "ADMIN";

export type NavLink = {
    label: string;
    href: string;
};

const ROLE_NAV_LINKS: Record<UserRole, NavLink[]> = {
    CANDIDATE: [
        { label: "Browse", href: appRoutes.candidate.browse },
        { label: "Chats", href: appRoutes.candidate.chats },
        { label: "Availability", href: appRoutes.candidate.availability },
        { label: "Settings", href: appRoutes.candidate.settings },
    ],
    PROFESSIONAL: [
        { label: "Dashboard", href: appRoutes.professional.dashboard },
        { label: "Requests", href: appRoutes.professional.requests },
        { label: "Earnings", href: appRoutes.professional.earnings },
        { label: "Settings", href: appRoutes.professional.settings },
    ],
    ADMIN: [
        { label: "Bookings", href: appRoutes.admin.bookings },
        { label: "Disputes", href: appRoutes.admin.disputes },
        { label: "Users", href: appRoutes.admin.users },
        { label: "Feedback", href: appRoutes.admin.feedback },
        { label: "Payments", href: appRoutes.admin.payments },
    ],
};

export function resolveNavLinksForSessionUser(user: {
    role: UserRole;
    onboardingRequired?: boolean;
    onboardingCompleted?: boolean;
}) {
    const onboardingBlocked =
        (user.role === "CANDIDATE" || user.role === "PROFESSIONAL") &&
        user.onboardingRequired === true &&
        user.onboardingCompleted !== true;

    if (onboardingBlocked) {
        return [{ label: "Onboarding", href: "/onboarding" }];
    }

    return ROLE_NAV_LINKS[user.role] ?? [];
}
