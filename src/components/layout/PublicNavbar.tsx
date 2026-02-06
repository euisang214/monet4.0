"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "@/app/(public)/public.module.css";

export function PublicNavbar() {
    const pathname = usePathname();
    const isLoginPage = pathname === "/api/auth/signin";

    if (isLoginPage) return null;

    return (
        <nav className={styles.navbar}>
            <Link href="/" className={styles.navLogo}>
                <span className={styles.logoBadge} />
                Monet
            </Link>

            <div className={styles.navLinks}>
                <Link href="/pricing" className={styles.navLink}>Pricing</Link>
                <Link href="/candidate/browse" className={styles.navLink}>Browse</Link>
            </div>

            <div className={styles.navButtons}>
                <Link href="/api/auth/signin" className="btn bg-gray-100 text-gray-800 hover:bg-gray-200">
                    Log in
                </Link>
                <Link href="/api/auth/signin?callbackUrl=/professional/dashboard" className="btn bg-blue-600 text-white hover:bg-blue-700">
                    Get Started
                </Link>
            </div>
        </nav>
    );
}
