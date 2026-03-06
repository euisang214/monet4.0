import React from "react";
import { EmptyState } from "@/components/ui/composites/EmptyState";
import { DataTable, type DataColumn } from "@/components/ui/composites/DataTable/DataTable";

export interface Column<T> {
    header: string;
    accessor: (row: T) => React.ReactNode;
    className?: string;
}

interface AdminDataTableProps<T> {
    columns: Column<T>[];
    data: T[];
    getRowKey: (row: T) => string;
    emptyMessage?: string;
}

export function AdminDataTable<T>({
    columns,
    data,
    getRowKey,
    emptyMessage = "No records found.",
}: AdminDataTableProps<T>) {
    const migratedColumns: DataColumn<T>[] = columns.map((column, index) => ({
        key: `${column.header}-${index}`,
        header: column.header,
        cell: column.accessor,
        className: column.className,
        align: column.className?.includes("text-right") ? "right" : "left",
        priority: index === 0 ? "primary" : "secondary",
    }));

    return (
        <DataTable
            columns={migratedColumns}
            data={data}
            getRowKey={getRowKey}
            density="compact"
            emptyState={
                <EmptyState
                    title={emptyMessage}
                    description="Adjust your filters or try again later."
                    badge="Nothing queued"
                    layout="inline"
                />
            }
        />
    );
}
