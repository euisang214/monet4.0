"use client";

import React, { useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/primitives/Button";
import { appRoutes } from "@/lib/shared/routes";
import { resolveNavLinksForSessionUser, type UserRole } from "@/components/layout/auth-navbar-links";
import { cn } from "@/lib/ui/cn";
import styles from "./AuthNavbar.module.css";

const CANDIDATE_DASHBOARD_LEGACY_PATH = "/candidate/dashboard";
const AUTH_NAV_HIDDEN_EXACT_PATHS = new Set([
    "/",
    "/pricing",
    "/login",
    "/signup",
    "/forgot-password",
    "/auth/reset",
]);
const AUTH_NAV_HIDDEN_PREFIXES = ["/pricing/"];

function shouldHideAuthNavbar(pathname: string) {
    if (AUTH_NAV_HIDDEN_EXACT_PATHS.has(pathname)) {
        return true;
    }

    return AUTH_NAV_HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function AuthNavbar() {
    const pathname = usePathname();

    if (shouldHideAuthNavbar(pathname)) return null;

    return <AuthenticatedNavbar pathname={pathname} />;
}

function AuthenticatedNavbar({ pathname }: { pathname: string }) {
    const { data: session, status } = useSession();
    const [isPending, startTransition] = useTransition();

    if (status === "loading") return null;
    if (!session?.user) return null;

    const handleLogout = () => {
        startTransition(async () => {
            await signOut({ callbackUrl: "/" });
        });
    };

    const userRole = session.user.role as UserRole;
    const navLinks = resolveNavLinksForSessionUser({
        role: userRole,
        onboardingRequired: session.user.onboardingRequired,
        onboardingCompleted: session.user.onboardingCompleted,
    });
    const homeLink = navLinks[0]?.href ?? "/";
    const userEmail = session.user.email ?? "Account";

    return (
        <nav className={styles.nav} aria-label="Authenticated navigation">
            <div className={styles.panel}>
                <div className={styles.brandRow}>
                    <Link href={homeLink} className={styles.brand}>
                        <span className={styles.brandBadge} />
                        Monet
                    </Link>
                </div>

                <div className={styles.linksRow}>
                    <div className={styles.navScroller}>
                        {navLinks.map((link) => {
                            const isCandidateChatsRoute =
                                userRole === "CANDIDATE" &&
                                link.href === appRoutes.candidate.chats &&
                                (pathname.startsWith("/candidate/bookings/") || pathname === CANDIDATE_DASHBOARD_LEGACY_PATH);

                            const isActive =
                                isCandidateChatsRoute ||
                                pathname === link.href ||
                                pathname.startsWith(`${link.href}/`);

                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={cn(styles.navLink, isActive && styles.navLinkActive)}
                                    aria-current={isActive ? "page" : undefined}
                                >
                                    {link.label}
                                </Link>
                            );
                        })}
                    </div>
                </div>

                <div className={styles.actionsRow}>
                    <span className={styles.email} title={userEmail}>
                        {userEmail}
                    </span>
                    <Button
                        onClick={handleLogout}
                        disabled={isPending}
                        className={styles.logoutButton}
                        variant="secondary"
                    >
                        {isPending ? "Signing out..." : "Log out"}
                    </Button>
                </div>
            </div>
        </nav>
    );
}
