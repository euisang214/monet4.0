"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import styles from "@/app/(public)/public.module.css";
import {
    buildAudienceUrl,
    DEFAULT_AUDIENCE,
    LANDING_AUDIENCE_QUERY_PARAM,
    LANDING_AUDIENCE_STORAGE_KEY,
    LANDING_CONTENT,
    parseAudience,
    resolveAudience,
    type LandingAudience,
} from "./landing-content";

interface LandingPageContentProps {
    audience: LandingAudience;
    onAudienceChange: (audience: LandingAudience) => void;
}

export function LandingPageContent({ audience, onAudienceChange }: LandingPageContentProps) {
    const content = LANDING_CONTENT[audience];

    return (
        <div>
            <section className={styles.hero}>
                <div className={styles.audienceSwitcher}>
                    <p className={styles.audienceLabel}>Who are you using Monet as?</p>
                    <div className={styles.audienceOptions} role="group" aria-label="Choose your audience">
                        <button
                            type="button"
                            aria-pressed={audience === "candidate"}
                            className={`${styles.audienceOption} ${audience === "candidate" ? styles.audienceOptionActive : ""}`}
                            onClick={() => onAudienceChange("candidate")}
                        >
                            Candidate
                        </button>
                        <button
                            type="button"
                            aria-pressed={audience === "professional"}
                            className={`${styles.audienceOption} ${audience === "professional" ? styles.audienceOptionActive : ""}`}
                            onClick={() => onAudienceChange("professional")}
                        >
                            Professional
                        </button>
                    </div>
                </div>

                <div key={`hero-${audience}`} className={styles.roleContentSwap}>
                    <h1 className={styles.heroTitle}>{content.hero.title}</h1>
                    <p className={styles.heroSubtitle}>{content.hero.subtitle}</p>
                    <div className={styles.heroButtons}>
                        <Link href={content.hero.primaryCta.href} className="btn bg-blue-600 text-white hover:bg-blue-700">
                            {content.hero.primaryCta.label}
                        </Link>
                    </div>

                    <div className={styles.statStrip}>
                        {content.stats.map((stat) => (
                            <div key={`${stat.value}-${stat.label}`} className={styles.statCard}>
                                <div className={styles.statValue}>{stat.value}</div>
                                <div className={styles.statLabel}>{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>How It Works</h2>
                <p className={styles.sectionLead}>
                    Request, schedule, meet. We keep the logistics tight so you can focus on the conversation.
                </p>
                <div key={`steps-${audience}`} className={`${styles.steps} ${styles.roleContentSwap}`}>
                    {content.steps.map((step, index) => (
                        <article key={step.title} className={styles.step}>
                            <div className={styles.stepNumber}>{index + 1}</div>
                            <h3 className={styles.stepTitle}>{step.title}</h3>
                            <p className={styles.stepDescription}>{step.description}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section id="about" className={`${styles.section} ${styles.anchorSection}`}>
                <h2 className={styles.sectionTitle}>About</h2>
                <p className={styles.sectionLead}>
                    Undergraduate recruiting and networking is a black box. We saw brilliant students get shut out, so we built <b>Monet</b> to
                    change the odds.
                    <br />
                    <br />
                    Join the marketplace that democratizes recruiting. Students access the right tools, prep, and insider knowledge through real
                    conversations with professionals.
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
                <p className={styles.sectionLead}>Quick answers about bookings, payments, and session setup.</p>
                <div key={`faq-${audience}`} className={`${styles.faqList} ${styles.roleContentSwap}`}>
                    {content.faq.map((faq) => (
                        <article key={faq.question} className={styles.faqItem}>
                            <h3 className={styles.faqQuestion}>{faq.question}</h3>
                            <p className={styles.faqAnswer}>{faq.answer}</p>
                        </article>
                    ))}
                </div>
            </section>
        </div>
    );
}

export function LandingPageClient() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const searchAudience = searchParams.get(LANDING_AUDIENCE_QUERY_PARAM);
    const searchParamsString = searchParams.toString();
    const parsedSearchAudience = parseAudience(searchAudience);
    const audience = parsedSearchAudience ?? DEFAULT_AUDIENCE;

    useEffect(() => {
        const storedAudience = window.localStorage.getItem(LANDING_AUDIENCE_STORAGE_KEY);
        const resolvedAudience = resolveAudience(searchAudience, storedAudience);

        window.localStorage.setItem(LANDING_AUDIENCE_STORAGE_KEY, resolvedAudience);

        if (parsedSearchAudience !== resolvedAudience) {
            const nextUrl = buildAudienceUrl(
                pathname,
                new URLSearchParams(searchParamsString),
                resolvedAudience,
                window.location.hash
            );
            router.replace(nextUrl, { scroll: false });
        }
    }, [parsedSearchAudience, pathname, router, searchAudience, searchParamsString]);

    function handleAudienceChange(nextAudience: LandingAudience) {
        if (nextAudience === audience && parsedSearchAudience === nextAudience) {
            return;
        }

        window.localStorage.setItem(LANDING_AUDIENCE_STORAGE_KEY, nextAudience);

        const nextUrl = buildAudienceUrl(
            pathname,
            new URLSearchParams(searchParamsString),
            nextAudience,
            window.location.hash
        );
        router.replace(nextUrl, { scroll: false });
    }

    return <LandingPageContent audience={audience} onAudienceChange={handleAudienceChange} />;
}
