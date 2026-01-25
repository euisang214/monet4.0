import Link from "next/link";
import { Button } from "@/components/ui/Button";
import styles from "../public.module.css";

export default function PricingPage() {
    return (
        <div className={styles.pricingContainer}>
            <h1 className={styles.sectionTitle}>Simple, Transparent Pricing</h1>
            <p className={styles.heroSubtitle}>
                We only make money when you do. No monthly fees or subscriptions.
            </p>

            <div className={styles.pricingCard}>
                <h2>Platform Fee</h2>
                <div className={styles.price}>20%</div>
                <p className={styles.priceSub}>per completed booking</p>

                <div className={styles.pricingFeatures}>
                    <div className={styles.feature}>
                        <span className={styles.checkmark}>✓</span>
                        <span>No listing fees</span>
                    </div>
                    <div className={styles.feature}>
                        <span className={styles.checkmark}>✓</span>
                        <span>Secure payment processing</span>
                    </div>
                    <div className={styles.feature}>
                        <span className={styles.checkmark}>✓</span>
                        <span>Automated scheduling & video</span>
                    </div>
                    <div className={styles.feature}>
                        <span className={styles.checkmark}>✓</span>
                        <span>Quality control & dispute resolution</span>
                    </div>
                </div>

                <div style={{ marginTop: "2rem" }}>
                    <Link href="/api/auth/signin?callbackUrl=/professional/dashboard">
                        <Button>
                            Start Earning Today
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
