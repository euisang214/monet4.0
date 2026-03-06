import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Field, FileInput, FormSection, SelectInput, TextAreaInput, TextInput } from "@/components/ui";

describe("Form primitives", () => {
    it("renders shared field and section primitives", () => {
        const html = renderToStaticMarkup(
            <FormSection title="Account basics" description="Shared form framing.">
                <Field label="Name" htmlFor="name-input" hint="Use your full name.">
                    <TextInput id="name-input" value="Casey" onChange={() => {}} />
                </Field>
                <Field label="Timezone" htmlFor="timezone-input">
                    <SelectInput id="timezone-input" value="UTC" onChange={() => {}}>
                        <option value="UTC">UTC</option>
                    </SelectInput>
                </Field>
                <Field label="Bio" htmlFor="bio-input">
                    <TextAreaInput id="bio-input" value="Bio" onChange={() => {}} autoResize />
                </Field>
                <Field label="Resume" htmlFor="resume-input">
                    <FileInput id="resume-input" type="file" onChange={() => {}} />
                </Field>
            </FormSection>
        );

        expect(html).toContain("Account basics");
        expect(html).toContain("Shared form framing.");
        expect(html).toContain("Use your full name.");
        expect(html).toContain('id="name-input"');
        expect(html).toContain('id="timezone-input"');
        expect(html).toContain('id="bio-input"');
        expect(html).toContain('id="resume-input"');
    });
});
