import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
    usePathname: () => "/admin/bookings",
}));

import AdminLayout from "@/app/admin/layout";

describe("AdminLayout navigation", () => {
    it("renders body content without a secondary section navigation shell", () => {
        const html = renderToStaticMarkup(
            <AdminLayout>
                <div>Admin body</div>
            </AdminLayout>
        );

        expect(html).toContain("Admin body");
        expect(html).not.toContain('aria-label="Section navigation"');
    });
});
