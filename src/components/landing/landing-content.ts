export type LandingAudience = "candidate" | "professional";

export interface LandingCta {
    label: string;
    href: string;
}

export interface LandingHero {
    title: string;
    subtitle: string;
    primaryCta: LandingCta;
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
            title: "Structured recruiting prep. \nReal professionals.",
            subtitle:
                "Connect with verified analysts and associates in finance and consulting. \nClear feedback. Actionable next steps. No cold DMs.",
            primaryCta: {
                label: "Browse Professionals",
                href: "/signup?role=candidate",
            },
        },
        stats: [
            {
                value: "30 Min",
                label: "Focused 1:1 format",
            },
            {
                value: "3 Actions",
                label: "Concrete takeaways every call",
            },
            {
                value: "Fast Setup",
                label: "Secure payment & calendar sync",
            },
        ],
        steps: [
            {
                title: "Request Professional",
                description: "Browse professionals aligned to your target role and goals. Submit a booking request.",
            },
            {
                title: "Schedule Time",
                description: "Choose an available slot once accepted. Monet handles the calendar and meeting link setup.",
            },
            {
                title: "Join Chat",
                description: "Join the call, get practical feedback, and leave with action items you can apply immediately.",
            },
        ],
        faq: [
            {
                question: "What can I use a session for?",
                answer: "We encourage conversations to be open-ended and flow naturally, but many use sessions for interview prep, resume feedback, networking strategy, or role-specific career advice from experienced professionals.",
            },
            {
                question: "When am I charged?",
                answer: "Payment is authorized when you request a booking and charged after the session is completed and the Professional has submitted their feedback for you.",
            },
            {
                question: "Can I reschedule if needed?",
                answer: "Yes. Monet supports reschedule requests for both candidates and professionals six hours before the scheduled slot. Cancellations after six hours or no-shows will incur a fee.",
            },
            {
                question: "Do I need a subscription?",
                answer: "No. There is no subscription required. You only pay when you book sessions.",
            },
        ],
    },
    professional: {
        hero: {
            title: "Turn Your Experience Into \nImpact and Income",
            subtitle:
                "Help candidates focus on the right things through structured, 30-minute chats. \nYou choose your rate and availability. We handle the logistics.",
            primaryCta: {
                label: "Become a Professional",
                href: "/signup?role=professional",
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
                value: "Logistics Handled",
                label: "Scheduling, payment, reminders, and meeting links are managed for you",
            },
        ],
        steps: [
            {
                title: "Create Profile",
                description: "List your background and role",
            },
            {
                title: "Review Request",
                description: "Candidates submit availability and goals. Accept only what aligns",
            },
            {
                title: "Join Chat",
                description: "Join the call, submit structured feedback. Payout is released after feedback is complete",
            },
        ],
        faq: [
            {
                question: "How do payments work for professionals?",
                answer: "Candidates authorize payment when they request you and are charged after you submit feedback. Your earnings flow through your connected payout account after platform fees.",
            },
            {
                question: "Can I control when I’m available?",
                answer: "Yes. You choose when to accept requests and confirm times based on your own schedule.",
            },
            {
                question: "What happens if a session is rescheduled?",
                answer: "Either side can request a reschedule six hours before the slot, and Monet guides both sides through the updated scheduling flow. Cancellations after six hours or no-shows will incur a fee.",
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
