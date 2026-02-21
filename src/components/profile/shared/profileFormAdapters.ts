import {
    createEmptyEducationEntry,
    createEmptyExperienceEntry,
    EducationEntry,
    EducationFormEntry,
    ensureExactlyOneCurrentExperience,
    ExperienceFormEntry,
    mapEducationEntries,
    mapTimelineEntries,
    normalizeCommaSeparated,
    normalizeCurrentExperienceEntries,
    serializeEducationEntries,
    serializeExperienceEntries,
    TimelineEntry,
} from "@/components/profile/timeline-form";

export type {
    TimelineEntry,
    EducationEntry,
    ExperienceFormEntry,
    EducationFormEntry,
};

export {
    createEmptyEducationEntry,
    createEmptyExperienceEntry,
    ensureExactlyOneCurrentExperience,
    mapEducationEntries,
    mapTimelineEntries,
    normalizeCommaSeparated,
    normalizeCurrentExperienceEntries,
    serializeEducationEntries,
    serializeExperienceEntries,
};

export type SerializedTimelineEntry = ReturnType<typeof serializeExperienceEntries>[number];
export type SerializedEducationEntry = ReturnType<typeof serializeEducationEntries>[number];
