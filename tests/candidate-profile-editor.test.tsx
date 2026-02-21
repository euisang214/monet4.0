import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CandidateProfileEditor } from "@/components/profile/CandidateProfileEditor";

describe("CandidateProfileEditor", () => {
    it("renders shared candidate profile sections", () => {
        const html = renderToStaticMarkup(
            <CandidateProfileEditor
                mode="settings"
                initialData={{
                    timezone: "America/New_York",
                    resumeUrl: "https://storage.example.com/resume.pdf",
                    resumeViewUrl: "https://signed.example.com/resume.pdf",
                    interests: ["Interview Prep"],
                    experience: [
                        {
                            company: "Acme",
                            title: "Analyst",
                            startDate: "2023-01-01",
                            isCurrent: true,
                        },
                    ],
                    activities: [
                        {
                            company: "Club",
                            title: "Mentor",
                            startDate: "2022-01-01",
                            isCurrent: true,
                        },
                    ],
                    education: [
                        {
                            school: "State U",
                            degree: "BS",
                            fieldOfStudy: "Economics",
                            startDate: "2018-09-01",
                            isCurrent: false,
                        },
                    ],
                }}
                submitLabel="Save changes"
                onSubmit={async () => {}}
            />
        );

        expect(html).toContain("Resume (PDF)");
        expect(html).toContain("Add experience");
        expect(html).toContain("Add activity");
        expect(html).toContain("Add education");
        expect(html).toContain('id="candidate-timezone"');
        expect(html).toContain("<select");
        expect(html).toContain('value="UTC"');
        expect(html).toContain("Save changes");
    });
});
