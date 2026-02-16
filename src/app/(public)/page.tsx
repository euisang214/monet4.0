import Link from "next/link";
import styles from "./public.module.css";

export default function LandingPage() {
    return (
        <div>
            <section className={styles.hero}>
                <h1 className={styles.heroTitle}>
                    Career Advice That <br></br>Actually Moves the Needle
                </h1>
                <p className={styles.heroSubtitle}>
                    Book 1:1 calls with seasoned professionals in finance and consulting. <br></br>Prepare for your next career move with confidence. 
                </p>
                <div className={styles.heroButtons}>
                    <Link href="/signup?role=candidate" className="btn bg-blue-600 text-white hover:bg-blue-700">
                        Browse Professionals
                    </Link>
                    <Link href="/signup?role=professional" className={`btn ${styles.professionalCta}`}>
                        Become a Professional
                    </Link>
                </div>

                <div className={styles.statStrip}>
                    <div className={styles.statCard}>
                        <div className={styles.statValue}>30 Min</div>
                        <div className={styles.statLabel}>Focused 1:1 format</div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={styles.statValue}>3 Actions</div>
                        <div className={styles.statLabel}>Concrete takeaways per call</div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={styles.statValue}>Fast Setup</div>
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

            <section id="about" className={`${styles.section} ${styles.anchorSection}`}>
                <h2 className={styles.sectionTitle}>About</h2>
                <p className={styles.sectionLead}>
                    Undergraduate recruiting and networking is a black box. We saw brilliant students get shut out, so we built <b>Monet</b> to change the odds.
                    <br></br><br></br>Join the marketplace that democratizes recruiting. Students access the right tools, prep, and insider knowledge through real conversations with professionals.
                </p>
                <div className={styles.aboutGrid}>
                    <article className={styles.aboutCard}>
                        <h3 className={styles.aboutTitle}>Built for outcomes</h3>
                        <p className={styles.aboutDescription}>
                            Every session is designed around specific goals so you can walk away with clear next steps.
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
                            Booking, payment, and post-session follow-ups are directly built into the platform.
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
                            Most sessions are 30 minutes. Candidates choose what they want to discuss, and Monet provides potential topics and ideas to be creative with.
                        </p>
                    </article>
                    <article className={styles.faqItem}>
                        <h3 className={styles.faqQuestion}>When am I charged?</h3>
                        <p className={styles.faqAnswer}>
                            Payment is authorized when you request a booking and charged after the session is completed.
                        </p>
                    </article>
                    <article className={styles.faqItem}>
                        <h3 className={styles.faqQuestion}>Can I reschedule if needed?</h3>
                        <p className={styles.faqAnswer}>
                            Yes. Monet supports reschedule requests for both candidates and professionals before the scheduled slot.
                        </p>
                    </article>
                                        <article className={styles.faqItem}>
                        <h3 className={styles.faqQuestion}>How does it work for me as a Professional?</h3>
                        <p className={styles.faqAnswer}>
                            You'll have the chance mentor and guide the next generation of talent by monetizing your expertise and time. Set your own rates and schedule, and earn on your terms.
                        </p>
                    </article>
                </div>
            </section>
        </div>
    );
}
