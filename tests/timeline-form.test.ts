import { describe, expect, it } from "vitest";
import { mapEducationEntries, mapTimelineEntries } from "@/components/profile/shared/profileFormAdapters";

describe("timeline-form mappers", () => {
    it("normalizes ISO timestamps before binding timeline entries to date inputs", () => {
        const [entry] = mapTimelineEntries([
            {
                company: "Monet",
                title: "Principal",
                startDate: "2024-01-15T00:00:00.000Z",
                endDate: "2025-02-20T12:30:00.000Z",
                isCurrent: false,
            },
        ]);

        expect(entry).toMatchObject({
            startDate: "2024-01-15",
            endDate: "2025-02-20",
        });
    });

    it("returns empty date values when timeline dates are invalid", () => {
        const [entry] = mapTimelineEntries([
            {
                company: "Monet",
                title: "Principal",
                startDate: "not-a-date",
                endDate: null,
                isCurrent: true,
            },
        ]);

        expect(entry.startDate).toBe("");
        expect(entry.endDate).toBe("");
    });

    it("normalizes education dates before binding to date inputs", () => {
        const [entry] = mapEducationEntries([
            {
                school: "State U",
                degree: "MBA",
                fieldOfStudy: "Business",
                startDate: "2018-09-01T05:00:00.000Z",
                endDate: "2020-05-15T05:00:00.000Z",
                isCurrent: false,
            },
        ]);

        expect(entry).toMatchObject({
            startDate: "2018-09-01",
            endDate: "2020-05-15",
        });
    });
});
