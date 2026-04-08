"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { buttonVariants } from "@/components/ui/primitives/Button";
import styles from "./ShaderHero.module.css";
import type { LandingAudience, LandingContent } from "./landing-content";

interface MeshGradientProps {
    width: number;
    height: number;
    colors: string[];
    distortion: number;
    swirl: number;
    grainMixer: number;
    grainOverlay: number;
    speed: number;
    offsetX: number;
}

interface ShaderHeroProps {
    audience: LandingAudience;
    content: LandingContent;
    onAudienceChange: (audience: LandingAudience) => void;
}

const HERO_SHADER_COLORS = ["#72b9bb", "#b5d9d9", "#ffd1bd", "#ffebe0", "#8cc5b8", "#dbf4a4"];
const HERO_SHADER_CONFIG = {
    distortion: 0.78,
    swirl: 0.58,
    speed: 0.4,
    offsetX: 0.08,
};

export function ShaderHero({ audience, content, onAudienceChange }: ShaderHeroProps) {
    const heroRef = useRef<HTMLElement | null>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
    const [MeshGradientComponent, setMeshGradientComponent] = useState<ComponentType<MeshGradientProps> | null>(null);
    const [shaderState, setShaderState] = useState<"idle" | "ready" | "failed">("idle");

    useEffect(() => {
        const heroElement = heroRef.current;
        if (!heroElement) {
            return;
        }

        const updateDimensions = () => {
            const { width, height } = heroElement.getBoundingClientRect();
            setDimensions({
                width: Math.round(width),
                height: Math.round(height),
            });
        };

        updateDimensions();

        const observer = new ResizeObserver(() => {
            updateDimensions();
        });

        observer.observe(heroElement);

        return () => {
            observer.disconnect();
        };
    }, []);

    useEffect(() => {
        const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
        const updatePreference = () => {
            setPrefersReducedMotion(mediaQuery.matches);
        };

        updatePreference();
        mediaQuery.addEventListener("change", updatePreference);

        return () => {
            mediaQuery.removeEventListener("change", updatePreference);
        };
    }, []);

    useEffect(() => {
        if (prefersReducedMotion) {
            return;
        }

        let cancelled = false;

        import("@paper-design/shaders-react")
            .then((module) => {
                if (cancelled) {
                    return;
                }

                setMeshGradientComponent(() => module.MeshGradient as ComponentType<MeshGradientProps>);
                setShaderState("ready");
            })
            .catch(() => {
                if (cancelled) {
                    return;
                }

                setShaderState("failed");
            });

        return () => {
            cancelled = true;
        };
    }, [prefersReducedMotion]);

    const shouldRenderShader =
        !prefersReducedMotion &&
        shaderState === "ready" &&
        MeshGradientComponent !== null &&
        dimensions.width > 0 &&
        dimensions.height > 0;

    return (
        <section ref={heroRef} className={styles.hero}>
            <div className={styles.background} aria-hidden="true">
                <div className={styles.fallbackGradient} />
                {shouldRenderShader ? (
                    <MeshGradientComponent
                        width={dimensions.width}
                        height={dimensions.height}
                        colors={HERO_SHADER_COLORS}
                        distortion={HERO_SHADER_CONFIG.distortion}
                        swirl={HERO_SHADER_CONFIG.swirl}
                        grainMixer={0}
                        grainOverlay={0}
                        speed={HERO_SHADER_CONFIG.speed}
                        offsetX={HERO_SHADER_CONFIG.offsetX}
                    />
                ) : null}
                <div className={styles.veil} />
            </div>

            <div className={styles.content}>
                <div className={styles.contentRail}>
                    <div className={styles.audienceSwitcher}>
                        <div className={styles.brandLockup}>
                            <span className={styles.brandBadge}>Kafei</span>
                            <p className={styles.audienceLabel}>Structured conversations for recruiting prep</p>
                        </div>
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
                            <Link
                                href={content.hero.primaryCta.href}
                                className={`${buttonVariants({ variant: "primary", size: "lg" })} ${styles.heroButton}`}
                            >
                                {content.hero.primaryCta.label}
                            </Link>
                            <Link href="/#about" className={styles.secondaryLink}>
                                See how Kafei works
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
                </div>
            </div>
        </section>
    );
}
