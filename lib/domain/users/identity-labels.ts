type DateLike = Date | string | null | undefined;

export type IdentityExperience = {
    id?: string | null;
    title?: string | null;
    company?: string | null;
    startDate?: DateLike;
    endDate?: DateLike;
    isCurrent?: boolean | null;
};

export type IdentityEducation = {
    id?: string | null;
    school?: string | null;
    startDate?: DateLike;
    endDate?: DateLike;
    isCurrent?: boolean | null;
};

export const PROFESSIONAL_NAME_REVEAL_STATUS_LIST = [
    "accepted",
    "accepted_pending_integrations",
    "reschedule_pending",
    "dispute_pending",
    "completed_pending_feedback",
    "completed",
    "cancelled",
    "refunded",
] as const;

const PROFESSIONAL_NAME_REVEAL_STATUSES: ReadonlySet<string> = new Set<string>(PROFESSIONAL_NAME_REVEAL_STATUS_LIST);

function normalizeText(value: string | null | undefined) {
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function toTimestamp(value: DateLike) {
    if (!value) return Number.NEGATIVE_INFINITY;
    const parsed = value instanceof Date ? value : new Date(value);
    const time = parsed.getTime();
    return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY;
}

function compareIdentityRows(
    left: {
        id?: string | null;
        isCurrent?: boolean | null;
        startDate?: DateLike;
        endDate?: DateLike;
    },
    right: {
        id?: string | null;
        isCurrent?: boolean | null;
        startDate?: DateLike;
        endDate?: DateLike;
    }
) {
    const leftCurrent = left.isCurrent === true ? 1 : 0;
    const rightCurrent = right.isCurrent === true ? 1 : 0;
    if (leftCurrent !== rightCurrent) {
        return rightCurrent - leftCurrent;
    }

    const leftEnd = toTimestamp(left.endDate);
    const rightEnd = toTimestamp(right.endDate);
    if (leftEnd !== rightEnd) {
        return rightEnd - leftEnd;
    }

    const leftStart = toTimestamp(left.startDate);
    const rightStart = toTimestamp(right.startDate);
    if (leftStart !== rightStart) {
        return rightStart - leftStart;
    }

    const leftId = left.id ?? "";
    const rightId = right.id ?? "";
    return rightId.localeCompare(leftId);
}

function formatPersonName(firstName: string | null | undefined, lastName: string | null | undefined, fallback: string) {
    const name = [normalizeText(firstName), normalizeText(lastName)].filter(Boolean).join(" ");
    return name.length > 0 ? name : fallback;
}

export function formatRoleAtCompany(title: string | null | undefined, company: string | null | undefined, fallback = "Role not provided") {
    const normalizedTitle = normalizeText(title);
    const normalizedCompany = normalizeText(company);

    if (normalizedTitle && normalizedCompany) {
        return `${normalizedTitle} @ ${normalizedCompany}`;
    }

    if (normalizedTitle) {
        return normalizedTitle;
    }

    if (normalizedCompany) {
        return normalizedCompany;
    }

    return fallback;
}

export function pickCurrentOrLatestExperienceByEndDate(experiences: IdentityExperience[] | null | undefined) {
    if (!Array.isArray(experiences) || experiences.length === 0) {
        return null;
    }

    const ranked = [...experiences].sort(compareIdentityRows);
    return ranked[0] ?? null;
}

export function pickUniversity(education: IdentityEducation[] | null | undefined) {
    if (!Array.isArray(education) || education.length === 0) {
        return null;
    }

    const ranked = [...education].sort(compareIdentityRows);
    for (const row of ranked) {
        const school = normalizeText(row.school);
        if (school) {
            return school;
        }
    }

    return null;
}

export function formatCandidateForProfessionalView(input: {
    firstName?: string | null;
    lastName?: string | null;
    experience?: IdentityExperience[] | null;
    education?: IdentityEducation[] | null;
}) {
    const nameLabel = formatPersonName(input.firstName, input.lastName, "Candidate");
    const role = pickCurrentOrLatestExperienceByEndDate(input.experience);
    const roleLabel = formatRoleAtCompany(role?.title, role?.company, "");
    const university = pickUniversity(input.education);

    const suffixParts: string[] = [];
    if (university) {
        suffixParts.push(university);
    }
    if (roleLabel) {
        suffixParts.push(roleLabel);
    }

    if (suffixParts.length === 0) {
        return nameLabel;
    }

    return `${nameLabel} - ${suffixParts.join(", ")}`;
}

export function shouldRevealProfessionalNameForCandidateStatus(status: string | null | undefined) {
    if (!status) {
        return false;
    }
    return PROFESSIONAL_NAME_REVEAL_STATUSES.has(status);
}

export function formatProfessionalForCandidateView(input: {
    firstName?: string | null;
    lastName?: string | null;
    title?: string | null;
    company?: string | null;
    revealName?: boolean;
}) {
    const roleLabel = formatRoleAtCompany(input.title, input.company, "Professional");

    if (!input.revealName) {
        return roleLabel;
    }

    const nameLabel = formatPersonName(input.firstName, input.lastName, "Professional");
    const roleWithNoFallback = formatRoleAtCompany(input.title, input.company, "");

    if (!roleWithNoFallback) {
        return nameLabel;
    }

    return `${nameLabel} - ${roleWithNoFallback}`;
}
