"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/primitives/Button";
import { cn } from "@/lib/ui/cn";
import styles from "@/app/(public)/public.module.css";

export function PublicNavbar() {
    return (
        <nav className={styles.navbar}>
            <Link href="/" className={styles.navLogo}>
                <span className={styles.logoBadge} />
                Kafei
            </Link>

            <div className={styles.navLinks}>
                <Link href="/#about" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), styles.navButton)}>About</Link>
                <Link href="/#faq" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), styles.navButton)}>FAQ</Link>
                <Link href="/login" className={cn(buttonVariants({ variant: "secondary", size: "sm" }), styles.navButton)}>Login</Link>
                <Link href="/signup" className={cn(buttonVariants({ variant: "primary", size: "sm" }), styles.navButton)}>Signup</Link>
            </div>
        </nav>
    );
}
