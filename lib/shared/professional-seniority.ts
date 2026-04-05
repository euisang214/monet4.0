export const PROFESSIONAL_SENIORITIES = [
    "analyst",
    "associate",
    "consultant",
    "senior_associate",
    "senior_consultant",
    "manager",
    "senior_manager",
    "vice_president",
    "director",
    "managing_director",
    "principal",
    "counsel",
    "partner",
] as const;

export type ProfessionalSeniorityValue = (typeof PROFESSIONAL_SENIORITIES)[number];

export const PROFESSIONAL_SENIORITY_LABELS: Record<ProfessionalSeniorityValue, string> = {
    analyst: "Analyst",
    associate: "Associate",
    consultant: "Consultant",
    senior_associate: "Senior Associate",
    senior_consultant: "Senior Consultant",
    manager: "Manager",
    senior_manager: "Senior Manager",
    vice_president: "Vice President",
    director: "Director",
    managing_director: "Managing Director",
    principal: "Principal",
    counsel: "Counsel",
    partner: "Partner",
};

export function isProfessionalSeniority(value: string): value is ProfessionalSeniorityValue {
    return PROFESSIONAL_SENIORITIES.includes(value as ProfessionalSeniorityValue);
}

export function formatProfessionalSeniority(seniority: string | null | undefined) {
    if (!seniority || !isProfessionalSeniority(seniority)) {
        return null;
    }

    return PROFESSIONAL_SENIORITY_LABELS[seniority];
}
