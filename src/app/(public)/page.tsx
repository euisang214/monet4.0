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
                    <Link href="/signup?role=candidate" className="btn bg-blue-600 text-white hover:bg-blue-700">
                        Browse Professionals
                    </Link>
                    <Link href="/signup?role=professional" className="btn bg-gray-100 text-gray-800 hover:bg-gray-200">
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

            <section id="about" className={`${styles.section} ${styles.anchorSection}`}>
                <h2 className={styles.sectionTitle}>About Monet</h2>
                <p className={styles.sectionLead}>
                    Monet is a focused marketplace for practical career conversations. Candidates get high-signal advice, and professionals get paid for structured mentorship sessions.
                </p>
                <div className={styles.aboutGrid}>
                    <article className={styles.aboutCard}>
                        <h3 className={styles.aboutTitle}>Built for outcomes</h3>
                        <p className={styles.aboutDescription}>
                            Every session is designed around specific goals so you can walk away with clear next actions.
                        </p>
                    </article>
                    <article className={styles.aboutCard}>
                        <h3 className={styles.aboutTitle}>Verified workflows</h3>
                        <p className={styles.aboutDescription}>
                            Scheduling, reminders, and meeting logistics are handled in one flow to reduce no-shows and setup friction.
                        </p>
                    </article>
                    <article className={styles.aboutCard}>
                        <h3 className={styles.aboutTitle}>Designed for trust</h3>
                        <p className={styles.aboutDescription}>
                            Booking, payment authorization, and post-session follow-up are built into the platform from day one.
                        </p>
                    </article>
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

            <section id="faq" className={`${styles.section} ${styles.anchorSection}`}>
                <h2 className={styles.sectionTitle}>FAQ</h2>
                <p className={styles.sectionLead}>
                    Quick answers about bookings, payments, and session setup.
                </p>
                <div className={styles.faqList}>
                    <article className={styles.faqItem}>
                        <h3 className={styles.faqQuestion}>How long is each session?</h3>
                        <p className={styles.faqAnswer}>
                            Most sessions are 30 minutes and designed around one focused objective.
                        </p>
                    </article>
                    <article className={styles.faqItem}>
                        <h3 className={styles.faqQuestion}>When am I charged?</h3>
                        <p className={styles.faqAnswer}>
                            Payment is authorized when you request a booking and captured after the session is completed.
                        </p>
                    </article>
                    <article className={styles.faqItem}>
                        <h3 className={styles.faqQuestion}>Can I reschedule if needed?</h3>
                        <p className={styles.faqAnswer}>
                            Yes. Monet supports reschedule requests for both candidates and professionals before the scheduled slot.
                        </p>
                    </article>
                </div>
            </section>
        </div>
    );
}
