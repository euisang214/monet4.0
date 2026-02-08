"use client";

import Link from "next/link";
import styles from "@/app/(public)/public.module.css";

export function PublicNavbar() {
    return (
        <nav className={styles.navbar}>
            <Link href="/" className={styles.navLogo}>
                <span className={styles.logoBadge} />
                Monet
            </Link>

            <div className={styles.navLinks}>
                <Link href="/#about" className={styles.navLink}>About</Link>
                <Link href="/#faq" className={styles.navLink}>FAQ</Link>
                <Link href="/login" className={styles.navLink}>Login</Link>
                <Link href="/signup" className={`${styles.navLink} ${styles.navLinkCta}`}>Signup</Link>
            </div>
        </nav>
    );
}
