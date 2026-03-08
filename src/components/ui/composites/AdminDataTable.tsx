import React from 'react';

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
    emptyMessage = 'No records found.',
}: AdminDataTableProps<T>) {
    return (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        {columns.map((col) => (
                            <th
                                key={col.header}
                                className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${col.className ?? ''}`}
                            >
                                {col.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {data.length === 0 ? (
                        <tr>
                            <td colSpan={columns.length} className="px-6 py-4 text-center text-sm text-gray-500">
                                {emptyMessage}
                            </td>
                        </tr>
                    ) : (
                        data.map((row) => (
                            <tr key={getRowKey(row)} className="hover:bg-gray-50">
                                {columns.map((col) => (
                                    <td
                                        key={col.header}
                                        className={`px-6 py-4 whitespace-nowrap text-sm ${col.className ?? ''}`}
                                    >
                                        {col.accessor(row)}
                                    </td>
                                ))}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}
