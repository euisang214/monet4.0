import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const pathnameMock = vi.hoisted(() => vi.fn(() => "/candidate/browse"));

vi.mock("next/navigation", () => ({
    usePathname: pathnameMock,
}));

import { RoleAppShell } from "@/components/layout/RoleAppShell";

describe("RoleAppShell", () => {
    it("renders role navigation without intro copy and marks the active link", () => {
        const html = renderToStaticMarkup(
            <RoleAppShell
                navItems={[
                    { href: "/candidate/browse", label: "Browse" },
                    { href: "/candidate/settings", label: "Settings" },
                ]}
            >
                <div>Body content</div>
            </RoleAppShell>
        );

        expect(html).not.toContain("Workspace");
        expect(html).toContain("Browse");
        expect(html).toContain("Settings");
        expect(html).toContain('aria-current="page"');
        expect(html).toContain("Body content");
    });
});
