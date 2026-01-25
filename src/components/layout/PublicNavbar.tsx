"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import styles from "@/app/(public)/public.module.css";

export function PublicNavbar() {
    const pathname = usePathname();
    const isLoginPage = pathname === "/api/auth/signin";

    if (isLoginPage) return null;

    return (
        <nav className={styles.navbar}>
            <Link href="/" className={styles.navLogo}>
                <span style={{ fontSize: "1.5rem" }}>🎨</span>
                Monet
            </Link>

            <div className={styles.navLinks}>
                <Link href="/pricing" className={styles.navLink}>
                    Pricing
                </Link>
                {/* Add more public links here if needed */}
            </div>

            <div className={styles.navButtons}>
                <Link href="/api/auth/signin">
                    <Button /* variant="ghost" */>
                        Log in
                    </Button>
                </Link>
                <Link href="/api/auth/signin?callbackUrl=/professional/dashboard">
                    <Button>
                        Get Started
                    </Button>
                </Link>
            </div>
        </nav>
    );
}
