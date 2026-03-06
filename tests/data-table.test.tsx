import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DataTable, type DataColumn } from "@/components/ui";

type Row = {
    id: string;
    name: string;
    status: string;
};

const columns: DataColumn<Row>[] = [
    {
        key: "name",
        header: "Name",
        cell: (row) => row.name,
        priority: "primary",
    },
    {
        key: "status",
        header: "Status",
        cell: (row) => row.status,
        mobileLabel: "Current status",
    },
];

describe("DataTable", () => {
    it("renders table and mobile card content from one column config", () => {
        const html = renderToStaticMarkup(
            <DataTable
                columns={columns}
                data={[{ id: "1", name: "Candidate One", status: "Open" }]}
                getRowKey={(row) => row.id}
                caption="Operational queue"
                density="compact"
            />
        );

        expect(html).toContain("Operational queue");
        expect(html).toContain("Candidate One");
        expect(html).toContain("Current status");
        expect(html).toContain("Open");
    });
});
