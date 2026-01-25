import Link from "next/link";
import { Button } from "@/components/ui/Button";
import styles from "./public.module.css";

export default function LandingPage() {
    return (
        <div className={styles.container}>
            {/* Hero Section */}
            <section className={styles.hero}>
                <h1 className={styles.heroTitle}>
                    Connect with Top Professionals for <span style={{ color: "#2563eb" }}>1-on-1 Advice</span>
                </h1>
                <p className={styles.heroSubtitle}>
                    Get personalized guidance from industry experts. Book 30-minute video calls to accelerate your career or business.
                </p>
                <div className={styles.heroButtons}>
                    <Link href="/candidate/browse">
                        <Button>
                            Browse Professionals
                        </Button>
                    </Link>
                    <Link href="/api/auth/signin?callbackUrl=/professional/dashboard">
                        <Button>
                            Join as a Pro
                        </Button>
                    </Link>
                </div>
            </section>

            {/* How It Works Section */}
            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>How It Works</h2>
                <div className={styles.steps}>
                    <div className={styles.step}>
                        <div className={styles.stepNumber}>1</div>
                        <h3 className={styles.stepTitle}>Request</h3>
                        <p className={styles.stepDescription}>
                            Find a professional and request a booking. You'll only be charged when they accept.
                        </p>
                    </div>
                    <div className={styles.step}>
                        <div className={styles.stepNumber}>2</div>
                        <h3 className={styles.stepTitle}>Schedule</h3>
                        <p className={styles.stepDescription}>
                            Once accepted, pick a time that works for both of you from their real-time availability.
                        </p>
                    </div>
                    <div className={styles.step}>
                        <div className={styles.stepNumber}>3</div>
                        <h3 className={styles.stepTitle}>Call</h3>
                        <p className={styles.stepDescription}>
                            Join the video call directly from your dashboard. Get actionable advice and action items.
                        </p>
                    </div>
                </div>
            </section>
        </div>
    );
}
