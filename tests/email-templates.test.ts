import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderEmailTemplate } from "@/emails/render";
import {
    BookingRequestedEmail,
    PasswordResetEmail,
    VerificationEmail,
} from "@/emails/templates";

describe("email template rendering", () => {
    it("renders branded password reset content with CTA and plain text", async () => {
        const { html, text } = await renderEmailTemplate(
            createElement(PasswordResetEmail, {
                resetLink: "https://monet.ai/auth/reset?token=abc123",
            }),
        );

        expect(html).toContain("Kafei");
        expect(html).toContain("Reset your password");
        expect(html).toContain("https://monet.ai/auth/reset?token=abc123");
        expect(html).toContain("Reset password");
        expect(text).toContain("RESET YOUR PASSWORD");
    });

    it("renders the booking request template with polished details and CTA", async () => {
        const { html, text } = await renderEmailTemplate(
            createElement(BookingRequestedEmail, {
                formattedPrice: "$150.00",
                requestLink: "https://monet.ai/professional/requests/booking_123",
            }),
        );

        expect(html).toContain("New booking request");
        expect(html).toContain("Review request");
        expect(html).toContain("$150.00");
        expect(html).toContain("Response Window");
        expect(text).toContain("Review request");
    });

    it("renders the verification template with the code block and brand copy", async () => {
        const { html, text } = await renderEmailTemplate(
            createElement(VerificationEmail, {
                token: "482901",
            }),
        );

        expect(html).toContain("Kafei");
        expect(html).toContain("482901");
        expect(html).toContain("Verify your corporate email");
        expect(text).toContain("482901");
    });
});
