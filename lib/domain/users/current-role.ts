export type CurrentRole = {
    title: string | null;
    employer: string | null;
};

export type ProfessionalExperienceLike = {
    id?: string | null;
    title?: string | null;
    company?: string | null;
    isCurrent?: boolean | null;
    startDate?: Date | string | null;
};

function toTimestamp(value: Date | string | null | undefined) {
    if (!value) return Number.NEGATIVE_INFINITY;
    const parsed = value instanceof Date ? value : new Date(value);
    const time = parsed.getTime();
    return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY;
}

function normalizeText(value: string | null | undefined) {
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

export function getCanonicalProfessionalExperience<T extends ProfessionalExperienceLike>(experiences: T[]) {
    if (!Array.isArray(experiences) || experiences.length === 0) {
        return null;
    }

    const ranked = [...experiences].sort((a, b) => {
        const aCurrent = a.isCurrent === true ? 1 : 0;
        const bCurrent = b.isCurrent === true ? 1 : 0;
        if (aCurrent !== bCurrent) {
            return bCurrent - aCurrent;
        }

        const aStart = toTimestamp(a.startDate);
        const bStart = toTimestamp(b.startDate);
        if (aStart !== bStart) {
            return bStart - aStart;
        }

        const aId = a.id ?? "";
        const bId = b.id ?? "";
        return bId.localeCompare(aId);
    });

    return ranked[0] ?? null;
}

export function deriveCurrentRoleFromExperiences(experiences: ProfessionalExperienceLike[]): CurrentRole {
    const canonical = getCanonicalProfessionalExperience(experiences);

    if (!canonical) {
        return {
            title: null,
            employer: null,
        };
    }

    return {
        title: normalizeText(canonical.title),
        employer: normalizeText(canonical.company),
    };
}
