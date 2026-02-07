"use client";

import React, { useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/Button";

type UserRole = "CANDIDATE" | "PROFESSIONAL" | "ADMIN";

type NavLink = {
    label: string;
    href: string;
};

const ROLE_NAV_LINKS: Record<UserRole, NavLink[]> = {
    CANDIDATE: [
        { label: "Dashboard", href: "/candidate/dashboard" },
        { label: "Browse", href: "/candidate/browse" },
        { label: "Availability", href: "/candidate/availability" },
        { label: "History", href: "/candidate/history" },
        { label: "Settings", href: "/candidate/settings" },
    ],
    PROFESSIONAL: [
        { label: "Dashboard", href: "/professional/dashboard" },
        { label: "Requests", href: "/professional/requests" },
        { label: "Earnings", href: "/professional/earnings" },
        { label: "Settings", href: "/professional/settings" },
    ],
    ADMIN: [
        { label: "Bookings", href: "/admin/bookings" },
        { label: "Disputes", href: "/admin/disputes" },
        { label: "Users", href: "/admin/users" },
        { label: "Feedback", href: "/admin/feedback" },
        { label: "Payments", href: "/admin/payments" },
    ],
};

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

    const navLinks = ROLE_NAV_LINKS[session.user.role as UserRole] ?? [];
    const homeLink = navLinks[0]?.href ?? "/";

    return (
        <nav className="container" style={{ position: "sticky", top: "0.85rem", zIndex: 40, marginBottom: "0.6rem" }}>
            <div className="bg-white border border-gray-200 shadow-sm rounded-lg px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <Link href={homeLink} className="flex items-center gap-2 font-semibold text-gray-900 px-2 py-1 rounded-md hover:bg-gray-100">
                            <span
                                style={{
                                    width: "24px",
                                    height: "24px",
                                    display: "inline-block",
                                    borderRadius: "7px",
                                    background: "linear-gradient(135deg, #0b57d0, #14b8a6)",
                                }}
                            />
                            Monet
                        </Link>
                        {navLinks.map((link) => {
                            const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
                            const linkClasses = isActive
                                ? "px-3 py-1.5 rounded-md text-sm bg-blue-600 text-white"
                                : "px-3 py-1.5 rounded-md text-sm bg-gray-100 text-gray-700 hover:bg-gray-200";

                            return (
                                <Link key={link.href} href={link.href} className={linkClasses}>
                                    {link.label}
                                </Link>
                            );
                        })}
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-3">
                        <span className="text-sm text-gray-500">{session.user.email}</span>
                        <Button onClick={handleLogout} disabled={isPending} className="bg-gray-100 text-gray-800 hover:bg-gray-200">
                            {isPending ? "Signing out..." : "Log out"}
                        </Button>
                    </div>
                </div>
            </div>
        </nav>
    );
}
