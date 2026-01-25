import { PublicNavbar } from "@/components/layout/PublicNavbar";
import styles from "./public.module.css";

export default function PublicLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className={styles.publicLayout}>
            <PublicNavbar />
            <main className={styles.main}>
                {children}
            </main>
            <footer className={styles.footer}>
                <p>&copy; {new Date().getFullYear()} Monet Marketplace. All rights reserved.</p>
            </footer>
        </div>
    );
}
