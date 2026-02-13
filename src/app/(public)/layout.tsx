import { auth } from "@/auth";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import styles from "./public.module.css";

export default async function PublicLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();
    const shouldRenderPublicNavbar = !session?.user;

    return (
        <div className={styles.publicLayout}>
            {shouldRenderPublicNavbar ? <PublicNavbar /> : null}
            <main className={styles.main}>
                {children}
            </main>
            <footer className={styles.footer}>
                <p>&copy; {new Date().getFullYear()} Monet Marketplace. All rights reserved.</p>
            </footer>
        </div>
    );
}
