export type LandingAudience = "candidate" | "professional";

export interface LandingCta {
    label: string;
    href: string;
}

export interface LandingHero {
    title: string;
    subtitle: string;
    primaryCta: LandingCta;
    secondaryCta: LandingCta;
}

export interface LandingStat {
    value: string;
    label: string;
}

export interface LandingStep {
    title: string;
    description: string;
}

export interface LandingFaq {
    question: string;
    answer: string;
}

export interface LandingContent {
    hero: LandingHero;
    stats: LandingStat[];
    steps: LandingStep[];
    faq: LandingFaq[];
}

export const DEFAULT_AUDIENCE: LandingAudience = "candidate";
export const LANDING_AUDIENCE_QUERY_PARAM = "audience";
export const LANDING_AUDIENCE_STORAGE_KEY = "monet:landing:audience";

export const LANDING_CONTENT: Record<LandingAudience, LandingContent> = {
    candidate: {
        hero: {
            title: "Career Advice That Actually Moves the Needle",
            subtitle:
                "Book focused 1:1 calls with seasoned professionals in finance and consulting. Prepare for recruiting with clear feedback and next steps.",
            primaryCta: {
                label: "Browse Professionals",
                href: "/signup?role=candidate",
            },
            secondaryCta: {
                label: "Become a Professional",
                href: "/signup?role=professional",
            },
        },
        stats: [
            {
                value: "30 Min",
                label: "Focused 1:1 sessions",
            },
            {
                value: "Real Insight",
                label: "Advice from professionals who have hired and mentored",
            },
            {
                value: "Clear Next Steps",
                label: "Leave every call with an actionable prep plan",
            },
        ],
        steps: [
            {
                title: "Find your match",
                description: "Browse professionals aligned to your target role and goals.",
            },
            {
                title: "Request and schedule",
                description: "Submit a booking request and confirm a time that works.",
            },
            {
                title: "Execute your prep",
                description: "Join the call and apply feedback to your interview and networking plan.",
            },
        ],
        faq: [
            {
                question: "What can I use a session for?",
                answer:
                    "Use sessions for interview prep, resume feedback, networking strategy, or candid role-specific career advice from experienced professionals.",
            },
            {
                question: "When am I charged?",
                answer: "Payment is authorized when you request a booking and charged after the session is completed.",
            },
            {
                question: "Can I reschedule if needed?",
                answer: "Yes. Monet supports reschedule requests for both candidates and professionals before the scheduled slot.",
            },
            {
                question: "Do I need a subscription?",
                answer: "No. There is no subscription required. You only pay when you book sessions.",
            },
        ],
    },
    professional: {
        hero: {
            title: "Turn Your Experience Into Impact and Income",
            subtitle:
                "Mentor high-intent candidates, set your rate, and accept sessions on your schedule while Monet handles booking flow and logistics.",
            primaryCta: {
                label: "Become a Professional",
                href: "/signup?role=professional",
            },
            secondaryCta: {
                label: "Browse Professionals",
                href: "/signup?role=candidate",
            },
        },
        stats: [
            {
                value: "Set Your Rate",
                label: "Price sessions based on your expertise",
            },
            {
                value: "Flexible Schedule",
                label: "Accept requests that fit your availability",
            },
            {
                value: "Built-In Operations",
                label: "Booking, reminders, and session logistics in one flow",
            },
        ],
        steps: [
            {
                title: "Create your profile",
                description: "Showcase your background, focus areas, and session pricing.",
            },
            {
                title: "Review requests",
                description: "Accept candidate requests and confirm a suitable slot.",
            },
            {
                title: "Run sessions",
                description: "Deliver high-value calls and build trust through outcomes.",
            },
        ],
        faq: [
            {
                question: "How do payments work for professionals?",
                answer:
                    "Candidates authorize at request time and are charged after completed sessions. Your earnings flow through your connected payout account after platform fees.",
            },
            {
                question: "Can I control when I’m available?",
                answer: "Yes. You choose when to accept requests and confirm times based on your own schedule.",
            },
            {
                question: "What happens if a session is rescheduled?",
                answer: "Either side can request a reschedule before the slot, and Monet guides both sides through the updated scheduling flow.",
            },
            {
                question: "Is there a long-term commitment?",
                answer: "No. You can participate on your own terms and manage your availability as needed.",
            },
        ],
    },
};

export function parseAudience(value: string | null): LandingAudience | null {
    if (!value) {
        return null;
    }

    const normalized = value.toLowerCase();
    if (normalized === "candidate" || normalized === "professional") {
        return normalized;
    }

    return null;
}

export function resolveAudience(searchValue: string | null, storedValue: string | null): LandingAudience {
    const parsedSearchAudience = parseAudience(searchValue);
    if (parsedSearchAudience) {
        return parsedSearchAudience;
    }

    const parsedStoredAudience = parseAudience(storedValue);
    if (parsedStoredAudience) {
        return parsedStoredAudience;
    }

    return DEFAULT_AUDIENCE;
}

export function buildAudienceUrl(
    pathname: string,
    searchParams: URLSearchParams,
    audience: LandingAudience,
    hash?: string
): string {
    const params = new URLSearchParams(searchParams.toString());
    params.set(LANDING_AUDIENCE_QUERY_PARAM, audience);

    const query = params.toString();
    const normalizedHash = hash ? (hash.startsWith("#") ? hash : `#${hash}`) : "";

    return query ? `${pathname}?${query}${normalizedHash}` : `${pathname}${normalizedHash}`;
}
