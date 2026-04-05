export const PROFESSIONAL_INDUSTRIES = ["finance", "consulting", "law"] as const;

export type ProfessionalIndustryValue = (typeof PROFESSIONAL_INDUSTRIES)[number];

export const PROFESSIONAL_INDUSTRY_LABELS: Record<ProfessionalIndustryValue, string> = {
    finance: "Finance",
    consulting: "Consulting",
    law: "Law",
};

export function isProfessionalIndustry(value: string): value is ProfessionalIndustryValue {
    return PROFESSIONAL_INDUSTRIES.includes(value as ProfessionalIndustryValue);
}

export function formatProfessionalIndustry(industry: string | null | undefined) {
    if (!industry || !isProfessionalIndustry(industry)) {
        return null;
    }

    return PROFESSIONAL_INDUSTRY_LABELS[industry];
}
