export type TimelineEntry = {
    company: string;
    location?: string | null;
    startDate: string;
    endDate?: string | null;
    isCurrent?: boolean | null;
    title: string;
    description?: string | null;
};

export type EducationEntry = {
    school: string;
    location?: string | null;
    startDate: string;
    endDate?: string | null;
    isCurrent?: boolean | null;
    degree: string;
    fieldOfStudy: string;
    gpa?: number | null;
    honors?: string | null;
    activities?: string[] | null;
};

export type ExperienceFormEntry = {
    company: string;
    title: string;
    location: string;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
    description: string;
};

export type EducationFormEntry = {
    school: string;
    degree: string;
    fieldOfStudy: string;
    location: string;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
    gpa: string;
    honors: string;
    activities: string;
};

export function createEmptyExperienceEntry(): ExperienceFormEntry {
    return {
        company: "",
        title: "",
        location: "",
        startDate: "",
        endDate: "",
        isCurrent: false,
        description: "",
    };
}

export function createEmptyEducationEntry(): EducationFormEntry {
    return {
        school: "",
        degree: "",
        fieldOfStudy: "",
        location: "",
        startDate: "",
        endDate: "",
        isCurrent: false,
        gpa: "",
        honors: "",
        activities: "",
    };
}

export function normalizeCurrentExperienceEntries(entries: ExperienceFormEntry[]) {
    if (entries.length === 0) {
        return [
            {
                ...createEmptyExperienceEntry(),
                isCurrent: true,
            },
        ];
    }

    const currentIndexes = entries
        .map((entry, index) => (entry.isCurrent ? index : -1))
        .filter((index) => index >= 0);

    const selectedIndex = currentIndexes.length > 0 ? currentIndexes[0] : 0;

    return entries.map((entry, index) => ({
        ...entry,
        isCurrent: index === selectedIndex,
        endDate: index === selectedIndex ? "" : entry.endDate,
    }));
}

export function mapTimelineEntries(
    entries?: TimelineEntry[] | null,
    options?: { enforceSingleCurrent?: boolean }
): ExperienceFormEntry[] {
    const mapped =
        !entries || entries.length === 0
            ? [createEmptyExperienceEntry()]
            : entries.map((entry) => ({
                  company: entry.company || "",
                  title: entry.title || "",
                  location: entry.location || "",
                  startDate: entry.startDate || "",
                  endDate: entry.endDate || "",
                  isCurrent: Boolean(entry.isCurrent),
                  description: entry.description || "",
              }));

    if (options?.enforceSingleCurrent) {
        return normalizeCurrentExperienceEntries(mapped);
    }

    return mapped;
}

export function mapEducationEntries(entries?: EducationEntry[] | null): EducationFormEntry[] {
    if (!entries || entries.length === 0) {
        return [createEmptyEducationEntry()];
    }

    return entries.map((entry) => ({
        school: entry.school || "",
        degree: entry.degree || "",
        fieldOfStudy: entry.fieldOfStudy || "",
        location: entry.location || "",
        startDate: entry.startDate || "",
        endDate: entry.endDate || "",
        isCurrent: Boolean(entry.isCurrent),
        gpa: typeof entry.gpa === "number" ? entry.gpa.toString() : "",
        honors: entry.honors || "",
        activities: entry.activities?.join(", ") || "",
    }));
}

export function normalizeCommaSeparated(value: string) {
    return Array.from(
        new Set(
            value
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean)
        )
    );
}

function parseRequiredDate(value: string, label: string) {
    const parsed = new Date(value);
    if (!value || Number.isNaN(parsed.getTime())) {
        throw new Error(`${label} is required.`);
    }
    return parsed;
}

function parseOptionalDate(value: string, label: string) {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw new Error(`${label} is invalid.`);
    }
    return parsed;
}

export function ensureExactlyOneCurrentExperience(entries: ExperienceFormEntry[]) {
    return entries.filter((entry) => entry.isCurrent).length === 1;
}

export function serializeExperienceEntries(entries: ExperienceFormEntry[], sectionName: string) {
    if (entries.length === 0) {
        throw new Error(`At least one ${sectionName.toLowerCase()} entry is required.`);
    }

    return entries.map((entry, index) => {
        const itemPrefix = `${sectionName} entry ${index + 1}`;
        const company = entry.company.trim();
        const title = entry.title.trim();
        const startDate = entry.startDate.trim();
        const endDate = entry.endDate.trim();

        if (!company) throw new Error(`${itemPrefix}: company is required.`);
        if (!title) throw new Error(`${itemPrefix}: title is required.`);

        const start = parseRequiredDate(startDate, `${itemPrefix} start date`);
        const end = entry.isCurrent ? null : parseOptionalDate(endDate, `${itemPrefix} end date`);
        if (end && end < start) {
            throw new Error(`${itemPrefix}: end date cannot be before start date.`);
        }

        return {
            company,
            title,
            location: entry.location.trim() || null,
            startDate,
            endDate: entry.isCurrent ? null : endDate || null,
            isCurrent: entry.isCurrent,
            description: entry.description.trim() || null,
        };
    });
}

export function serializeEducationEntries(entries: EducationFormEntry[]) {
    if (entries.length === 0) {
        throw new Error("At least one education entry is required.");
    }

    return entries.map((entry, index) => {
        const itemPrefix = `Education entry ${index + 1}`;
        const school = entry.school.trim();
        const degree = entry.degree.trim();
        const fieldOfStudy = entry.fieldOfStudy.trim();
        const startDate = entry.startDate.trim();
        const endDate = entry.endDate.trim();

        if (!school) throw new Error(`${itemPrefix}: school is required.`);
        if (!degree) throw new Error(`${itemPrefix}: degree is required.`);
        if (!fieldOfStudy) throw new Error(`${itemPrefix}: field of study is required.`);

        const start = parseRequiredDate(startDate, `${itemPrefix} start date`);
        const end = entry.isCurrent ? null : parseOptionalDate(endDate, `${itemPrefix} end date`);
        if (end && end < start) {
            throw new Error(`${itemPrefix}: end date cannot be before start date.`);
        }

        const gpaValue = entry.gpa.trim();
        let gpa: number | null = null;
        if (gpaValue) {
            const parsedGpa = Number.parseFloat(gpaValue);
            if (!Number.isFinite(parsedGpa)) {
                throw new Error(`${itemPrefix}: GPA must be a valid number.`);
            }
            gpa = parsedGpa;
        }

        return {
            school,
            degree,
            fieldOfStudy,
            location: entry.location.trim() || null,
            startDate,
            endDate: entry.isCurrent ? null : endDate || null,
            isCurrent: entry.isCurrent,
            gpa,
            honors: entry.honors.trim() || null,
            activities: normalizeCommaSeparated(entry.activities),
        };
    });
}
