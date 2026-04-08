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
    type LandingContent,
    type LandingAudience,
} from "./landing-content";
import { ShaderHero } from "./ShaderHero";

interface LandingPageContentProps {
    audience: LandingAudience;
    content?: LandingContent;
    onAudienceChange: (audience: LandingAudience) => void;
}

export function LandingPageContent({ audience, content, onAudienceChange }: LandingPageContentProps) {
    const resolvedContent = content ?? LANDING_CONTENT[audience];

    return (
        <div className={styles.landingPage}>
            <div className={styles.heroBand}>
                <ShaderHero audience={audience} content={resolvedContent} onAudienceChange={onAudienceChange} />
            </div>

            <div className={styles.contentRail}>
                <section className={styles.section}>
                    <div className={styles.sectionIntro}>
                        <p className={styles.sectionEyebrow}>How It Works</p>
                        <h2 className={styles.sectionTitle}>A guided flow that keeps the conversation itself front and center.</h2>
                        <p className={styles.sectionLead}>
                            Request, schedule, meet. We handle the logistics so candidates and professionals can stay focused on preparation,
                            context, and next steps.
                        </p>
                    </div>
                    <div key={`steps-${audience}`} className={`${styles.steps} ${styles.roleContentSwap}`}>
                        {resolvedContent.steps.map((step, index) => (
                            <article key={step.title} className={styles.step}>
                                <div className={styles.stepNumber}>{index + 1}</div>
                                <div className={styles.stepBody}>
                                    <h3 className={styles.stepTitle}>{step.title}</h3>
                                    <p className={styles.stepDescription}>{step.description}</p>
                                </div>
                            </article>
                        ))}
                    </div>
                </section>

                <section id="about" className={`${styles.section} ${styles.anchorSection}`}>
                    <div className={styles.aboutLayout}>
                        <div className={styles.aboutLeadBlock}>
                            <p className={styles.sectionEyebrow}>About Kafei</p>
                            <h2 className={styles.aboutTitleLarge}>Recruiting should feel guided, not gated.</h2>
                            <p className={styles.aboutLead}>
                                Undergraduate recruiting and networking can feel opaque even for high-performing students. Kafei turns that black
                                box into a more structured path by connecting candidates with professionals who can offer real context, practical
                                feedback, and honest direction.
                            </p>
                        </div>

                        <div className={styles.aboutGrid}>
                            <article className={styles.aboutCard}>
                                <h3 className={styles.aboutTitle}>Built for outcomes</h3>
                                <p className={styles.aboutDescription}>
                                    Sessions stay focused on specific goals so every conversation ends with clear next steps instead of vague advice.
                                </p>
                            </article>
                            <article className={styles.aboutCard}>
                                <h3 className={styles.aboutTitle}>Structured behind the scenes</h3>
                                <p className={styles.aboutDescription}>
                                    Booking, reminders, scheduling, and follow-up all sit in one workflow designed to reduce friction on both sides.
                                </p>
                            </article>
                            <article className={styles.aboutCard}>
                                <h3 className={styles.aboutTitle}>Trust built into the product</h3>
                                <p className={styles.aboutDescription}>
                                    Verified participants, payment handling, and post-session accountability make the marketplace feel dependable.
                                </p>
                            </article>
                        </div>
                    </div>
                </section>

                <section id="faq" className={`${styles.section} ${styles.anchorSection}`}>
                    <div className={styles.sectionIntro}>
                        <p className={styles.sectionEyebrow}>FAQ</p>
                        <h2 className={styles.sectionTitle}>Quick answers before you book, apply, or get started.</h2>
                        <p className={styles.sectionLead}>The operational details stay simple so candidates and professionals can move quickly.</p>
                    </div>
                    <div key={`faq-${audience}`} className={`${styles.faqList} ${styles.roleContentSwap}`}>
                        {resolvedContent.faq.map((faq) => (
                            <article key={faq.question} className={styles.faqItem}>
                                <h3 className={styles.faqQuestion}>{faq.question}</h3>
                                <p className={styles.faqAnswer}>{faq.answer}</p>
                            </article>
                        ))}
                    </div>
                </section>

                <section className={styles.finalCta}>
                    <div className={styles.finalCtaCopy}>
                        <p className={styles.sectionEyebrow}>Start With Momentum</p>
                        <h2 className={styles.finalCtaTitle}>
                            {audience === "candidate"
                                ? "Meet someone who can sharpen your next recruiting move."
                                : "Turn what you know into a more useful, better-run mentorship workflow."}
                        </h2>
                        <p className={styles.finalCtaLead}>
                            {audience === "candidate"
                                ? "Browse vetted professionals, request time with confidence, and get structured feedback that actually helps."
                                : "Set your rate, accept the conversations that make sense, and let Kafei handle the scheduling mechanics."}
                        </p>
                    </div>
                    <div className={styles.finalCtaActions}>
                        <Link href={resolvedContent.hero.primaryCta.href} className={styles.finalCtaPrimary}>
                            {resolvedContent.hero.primaryCta.label}
                        </Link>
                        <Link href="/login" className={styles.finalCtaSecondary}>
                            Sign in
                        </Link>
                    </div>
                </section>
            </div>
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
    const content = LANDING_CONTENT[audience];

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

    return <LandingPageContent audience={audience} content={content} onAudienceChange={handleAudienceChange} />;
}
