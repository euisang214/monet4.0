"use client";

import React, { useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/primitives/Button";
import { appRoutes } from "@/lib/shared/routes";

type UserRole = "CANDIDATE" | "PROFESSIONAL" | "ADMIN";

type NavLink = {
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

const CANDIDATE_DASHBOARD_LEGACY_PATH = "/candidate/dashboard";

export function AuthNavbar() {
    const { data: session, status } = useSession();
    const [isPending, startTransition] = useTransition();
    const pathname = usePathname();

    if (status === "loading") return null;
    if (!session?.user) return null;

    const handleLogout = () => {
        startTransition(async () => {
            await signOut({ callbackUrl: "/" });
        });
    };

    const userRole = session.user.role as UserRole;
    const navLinks = ROLE_NAV_LINKS[userRole] ?? [];
    const homeLink = navLinks[0]?.href ?? "/";

    return (
        <nav className="container" style={{ position: "sticky", top: "0.85rem", zIndex: 40, marginBottom: "0.6rem" }}>
            <div className="bg-white border border-gray-200 shadow-sm rounded-lg px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <Link href={homeLink} className="flex items-center gap-2 font-semibold text-gray-900 px-2 py-1 rounded-md hover:bg-blue-100 auth-navbar-pressable">
                            <span
                                style={{
                                    width: "24px",
                                    height: "24px",
                                    display: "inline-block",
                                    borderRadius: "7px",
                                    background: "linear-gradient(135deg, var(--primary), var(--primary-strong))",
                                }}
                            />
                            Monet
                        </Link>
                        {navLinks.map((link) => {
                            const isCandidateChatsRoute =
                                userRole === "CANDIDATE" &&
                                link.href === appRoutes.candidate.chats &&
                                (pathname.startsWith("/candidate/bookings/") || pathname === CANDIDATE_DASHBOARD_LEGACY_PATH);

                            const isActive =
                                isCandidateChatsRoute ||
                                pathname === link.href ||
                                pathname.startsWith(`${link.href}/`);
                            const linkClasses = isActive
                                ? "px-3 py-1.5 rounded-md text-sm bg-blue-600 text-white"
                                : "px-3 py-1.5 rounded-md text-sm bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-gray-900 auth-navbar-pressable";

                            return (
                                <Link key={link.href} href={link.href} className={linkClasses}>
                                    {link.label}
                                </Link>
                            );
                        })}
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-3">
                        <span className="text-sm text-gray-500">{session.user.email}</span>
                        <Button onClick={handleLogout} disabled={isPending} className="bg-gray-100 text-gray-800 hover:bg-blue-100 auth-navbar-pressable">
                            {isPending ? "Signing out..." : "Log out"}
                        </Button>
                    </div>
                </div>
            </div>
        </nav>
    );
}
