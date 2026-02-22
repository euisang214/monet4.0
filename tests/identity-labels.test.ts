import { describe, expect, it } from "vitest";
import {
    formatCandidateForProfessionalView,
    formatProfessionalForCandidateView,
    formatRoleAtCompany,
    pickCurrentOrLatestExperienceByEndDate,
    pickUniversity,
    shouldRevealProfessionalNameForCandidateStatus,
} from "@/lib/domain/users/identity-labels";

describe("identity label utilities", () => {
    it("prefers current experience over ended experiences", () => {
        const selected = pickCurrentOrLatestExperienceByEndDate([
            {
                id: "exp-ended",
                title: "Associate",
                company: "Firm A",
                endDate: new Date("2025-12-01"),
                startDate: new Date("2025-01-01"),
                isCurrent: false,
            },
            {
                id: "exp-current",
                title: "Intern",
                company: "Firm B",
                endDate: null,
                startDate: new Date("2024-01-01"),
                isCurrent: true,
            },
        ]);

        expect(selected?.id).toBe("exp-current");
    });

    it("chooses latest ended experience when no current role exists", () => {
        const selected = pickCurrentOrLatestExperienceByEndDate([
            {
                id: "exp-1",
                title: "Analyst",
                company: "Firm A",
                endDate: new Date("2024-08-01"),
                startDate: new Date("2023-01-01"),
                isCurrent: false,
            },
            {
                id: "exp-2",
                title: "Associate",
                company: "Firm B",
                endDate: new Date("2025-10-01"),
                startDate: new Date("2024-09-01"),
                isCurrent: false,
            },
        ]);

        expect(selected?.id).toBe("exp-2");
    });

    it("picks university by current-first then latest dates", () => {
        const currentUniversity = pickUniversity([
            {
                id: "edu-ended",
                school: "University A",
                endDate: new Date("2024-05-01"),
                startDate: new Date("2020-09-01"),
                isCurrent: false,
            },
            {
                id: "edu-current",
                school: "Columbia University",
                endDate: null,
                startDate: new Date("2025-09-01"),
                isCurrent: true,
            },
        ]);

        const latestEndedUniversity = pickUniversity([
            {
                id: "edu-1",
                school: "University A",
                endDate: new Date("2024-05-01"),
                startDate: new Date("2020-09-01"),
                isCurrent: false,
            },
            {
                id: "edu-2",
                school: "University B",
                endDate: new Date("2025-05-01"),
                startDate: new Date("2021-09-01"),
                isCurrent: false,
            },
        ]);

        expect(currentUniversity).toBe("Columbia University");
        expect(latestEndedUniversity).toBe("University B");
    });

    it("formats candidate labels and omits missing sections cleanly", () => {
        const fullLabel = formatCandidateForProfessionalView({
            firstName: "John",
            lastName: "Doe",
            education: [{ school: "Columbia University", isCurrent: true }],
            experience: [{ title: "Intern", company: "Blackstone", isCurrent: true }],
        });
        const noUniversity = formatCandidateForProfessionalView({
            firstName: "John",
            lastName: "Doe",
            experience: [{ title: "Intern", company: "Blackstone", isCurrent: true }],
        });
        const noRole = formatCandidateForProfessionalView({
            firstName: "John",
            lastName: "Doe",
            education: [{ school: "Columbia University", isCurrent: true }],
            experience: [],
        });

        expect(fullLabel).toBe("John Doe - Columbia University, Intern @ Blackstone");
        expect(noUniversity).toBe("John Doe - Intern @ Blackstone");
        expect(noRole).toBe("John Doe - Columbia University");
    });

    it("formats professional labels by reveal state", () => {
        const preRevealLabel = formatProfessionalForCandidateView({
            firstName: "Avery",
            lastName: "Stone",
            title: "VP",
            company: "Goldman Sachs",
            revealName: false,
        });
        const revealLabel = formatProfessionalForCandidateView({
            firstName: "Avery",
            lastName: "Stone",
            title: "VP",
            company: "Goldman Sachs",
            revealName: true,
        });

        expect(preRevealLabel).toBe("VP @ Goldman Sachs");
        expect(revealLabel).toBe("Avery Stone - VP @ Goldman Sachs");
    });

    it("uses role/company fallbacks and reveal-status matrix", () => {
        expect(formatRoleAtCompany(null, null, "Professional")).toBe("Professional");

        const revealStatuses = [
            "accepted",
            "accepted_pending_integrations",
            "reschedule_pending",
            "dispute_pending",
            "completed_pending_feedback",
            "completed",
            "cancelled",
            "refunded",
        ];
        const nonRevealStatuses = ["draft", "requested", "declined", "expired"];

        for (const status of revealStatuses) {
            expect(shouldRevealProfessionalNameForCandidateStatus(status)).toBe(true);
        }

        for (const status of nonRevealStatuses) {
            expect(shouldRevealProfessionalNameForCandidateStatus(status)).toBe(false);
        }
    });
});
