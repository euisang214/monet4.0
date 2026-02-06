import Link from "next/link";
import styles from "../public.module.css";

export default function PricingPage() {
    return (
        <div className={styles.pricingContainer}>
            <h1 className={styles.sectionTitle}>Transparent Pricing</h1>
            <p className={styles.sectionLead}>No subscription. No listing fee. Platform fee applies only when a booking completes.</p>

            <section className={styles.pricingCard}>
                <h2>Platform Fee</h2>
                <div className={styles.price}>20%</div>
                <p className={styles.priceSub}>per completed booking</p>

                <div className={styles.pricingFeatures}>
                    <div className={styles.feature}><span className={styles.checkmark}>✓</span><span>No monthly charge</span></div>
                    <div className={styles.feature}><span className={styles.checkmark}>✓</span><span>Manual-capture payment flow</span></div>
                    <div className={styles.feature}><span className={styles.checkmark}>✓</span><span>Automated scheduling + meeting setup</span></div>
                    <div className={styles.feature}><span className={styles.checkmark}>✓</span><span>QC and dispute operations included</span></div>
                </div>

                <div style={{ marginTop: "2rem", textAlign: "center" }}>
                    <Link href="/api/auth/signin?callbackUrl=/professional/dashboard" className="btn bg-blue-600 text-white hover:bg-blue-700">
                        Start Earning
                    </Link>
                </div>
            </section>
        </div>
    );
}
