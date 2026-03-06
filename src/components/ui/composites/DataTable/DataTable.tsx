import React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/ui/cn";
import { SurfaceCard } from "@/components/ui/composites/SurfaceCard/SurfaceCard";
import styles from "./DataTable.module.css";

const RIGHT_ALIGN = "right";

export interface DataColumn<T> {
    key: string;
    header: string;
    cell: (row: T) => React.ReactNode;
    align?: "left" | "right";
    mobileLabel?: string;
    priority?: "primary" | "secondary";
    className?: string;
}

export interface DataTableProps<T> {
    columns: DataColumn<T>[];
    data: T[];
    getRowKey: (row: T) => string;
    caption?: string;
    emptyState?: React.ReactNode;
    density?: "comfortable" | "compact";
    className?: string;
}

const tableVariants = cva(styles.root, {
    variants: {
        density: {
            comfortable: "",
            compact: styles.compact,
        },
    },
    defaultVariants: {
        density: "comfortable",
    },
});

function resolvePrimaryColumn<T>(columns: DataColumn<T>[]) {
    return columns.find((column) => column.priority === "primary") ?? columns[0];
}

export function DataTable<T>({
    columns,
    data,
    getRowKey,
    caption,
    emptyState,
    density,
    className,
}: DataTableProps<T>) {
    const primaryColumn = resolvePrimaryColumn(columns);
    const secondaryColumns = columns.filter((column) => column.key !== primaryColumn?.key);
    const fallbackEmptyState = (
        <SurfaceCard className={styles.empty}>
            <p>No records found.</p>
        </SurfaceCard>
    );

    if (data.length === 0) {
        return <div className={cn(tableVariants({ density }), className)}>{emptyState ?? fallbackEmptyState}</div>;
    }

    return (
        <div className={cn(tableVariants({ density }), className)}>
            <div className={styles.tableWrap}>
                <table className={styles.table}>
                    {caption ? <caption className={styles.caption}>{caption}</caption> : null}
                    <thead className={styles.thead}>
                        <tr>
                            {columns.map((column) => (
                                <th
                                        key={column.key}
                                        className={cn(
                                            styles.headCell,
                                            column.align === RIGHT_ALIGN && styles.headCellRight,
                                            column.className
                                        )}
                                        scope="col"
                                >
                                    {column.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row) => (
                            <tr key={getRowKey(row)} className={styles.row}>
                                {columns.map((column) => (
                                    <td
                                        key={column.key}
                                        className={cn(
                                            styles.cell,
                                            column.align === RIGHT_ALIGN && styles.cellRight,
                                            column.className
                                        )}
                                    >
                                        {column.cell(row)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className={styles.mobileList}>
                {data.map((row) => (
                    <SurfaceCard key={getRowKey(row)} className={styles.mobileCard}>
                        <div className={styles.mobileHeader}>
                            <div className={styles.mobilePrimary}>{primaryColumn.cell(row)}</div>
                        </div>
                        <div className={styles.mobileRows}>
                            {secondaryColumns.map((column) => (
                                <div key={column.key} className={styles.mobileRow}>
                                    <span className={styles.mobileLabel}>{column.mobileLabel ?? column.header}</span>
                                    <div className={cn(styles.mobileValue, column.className)}>{column.cell(row)}</div>
                                </div>
                            ))}
                        </div>
                    </SurfaceCard>
                ))}
            </div>
        </div>
    );
}
