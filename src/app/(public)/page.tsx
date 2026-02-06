import Link from "next/link";
import styles from "./public.module.css";

export default function LandingPage() {
    return (
        <div>
            <section className={styles.hero}>
                <h1 className={styles.heroTitle}>
                    Career Advice Sessions That Actually Move the Needle
                </h1>
                <p className={styles.heroSubtitle}>
                    Book focused 1-on-1 calls with proven professionals. Clear next steps, practical feedback, and a smoother path to your next role.
                </p>
                <div className={styles.heroButtons}>
                    <Link href="/candidate/browse" className="btn bg-blue-600 text-white hover:bg-blue-700">
                        Browse Professionals
                    </Link>
                    <Link href="/api/auth/signin?callbackUrl=/professional/dashboard" className="btn bg-gray-100 text-gray-800 hover:bg-gray-200">
                        Become a Professional
                    </Link>
                </div>

                <div className={styles.statStrip}>
                    <div className={styles.statCard}>
                        <div className={styles.statValue}>30 min</div>
                        <div className={styles.statLabel}>Focused session format</div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={styles.statValue}>3 actions</div>
                        <div className={styles.statLabel}>Concrete takeaways per call</div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={styles.statValue}>Fast setup</div>
                        <div className={styles.statLabel}>Secure payment + calendar sync</div>
                    </div>
                </div>
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>How It Works</h2>
                <p className={styles.sectionLead}>
                    Request, schedule, meet. We keep the logistics tight so both sides can focus on the conversation.
                </p>
                <div className={styles.steps}>
                    <article className={styles.step}>
                        <div className={styles.stepNumber}>1</div>
                        <h3 className={styles.stepTitle}>Request</h3>
                        <p className={styles.stepDescription}>
                            Find someone aligned with your target role and submit a booking request with payment authorization.
                        </p>
                    </article>
                    <article className={styles.step}>
                        <div className={styles.stepNumber}>2</div>
                        <h3 className={styles.stepTitle}>Schedule</h3>
                        <p className={styles.stepDescription}>
                            Once accepted, choose an available slot. Monet handles the calendar and meeting link setup.
                        </p>
                    </article>
                    <article className={styles.step}>
                        <div className={styles.stepNumber}>3</div>
                        <h3 className={styles.stepTitle}>Execute</h3>
                        <p className={styles.stepDescription}>
                            Join the call, get practical feedback, and leave with action items you can apply immediately.
                        </p>
                    </article>
                </div>
            </section>
        </div>
    );
}
