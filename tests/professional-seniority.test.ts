import { describe, expect, it } from "vitest";
import {
    PROFESSIONAL_SENIORITIES,
    PROFESSIONAL_SENIORITY_LABELS,
    formatProfessionalSeniority,
    isProfessionalSeniority,
} from "@/lib/shared/professional-seniority";

describe("professional seniority helpers", () => {
    it("exposes the full predefined seniority list", () => {
        expect(PROFESSIONAL_SENIORITIES).toEqual([
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
        ]);
    });

    it("formats known seniority values into labels", () => {
        expect(PROFESSIONAL_SENIORITY_LABELS.managing_director).toBe("Managing Director");
        expect(formatProfessionalSeniority("senior_consultant")).toBe("Senior Consultant");
    });

    it("rejects unsupported seniority values", () => {
        expect(isProfessionalSeniority("principal")).toBe(true);
        expect(isProfessionalSeniority("executive")).toBe(false);
        expect(formatProfessionalSeniority("executive")).toBeNull();
    });
});
