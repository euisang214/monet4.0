import { format } from 'date-fns';

/**
 * Converts an array of objects to a CSV string.
 * Handles dates by formatting them to ISO strings or localized formats.
 * Escapes fields containing commas or quotes.
 */
export function exportTableToCsv<T extends Record<string, any>>(data: T[]): string {
    if (data.length === 0) {
        return '';
    }

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    for (const row of data) {
        const values = headers.map(header => {
            const val = row[header];
            const escaped = ('' + (val ?? '')).replace(/"/g, '""');

            // Handle Date objects specifically if needed, but standard string conversion usually suffices for ISO
            if (val instanceof Date) {
                return `"${val.toISOString()}"`;
            }

            return `"${escaped}"`;
        });
        csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
}

/**
 * Helper to flatten nested objects for CSV export if needed.
 * For complex models like User with partial Profile data, flattening might be desired.
 */
export function flattenObject(obj: Record<string, any>, prefix = ''): Record<string, any> {
    return Object.keys(obj).reduce((acc: Record<string, any>, k) => {
        const pre = prefix.length ? prefix + '.' : '';
        if (typeof obj[k] === 'object' && obj[k] !== null && !(obj[k] instanceof Date)) {
            Object.assign(acc, flattenObject(obj[k], pre + k));
        } else {
            acc[pre + k] = obj[k];
        }
        return acc;
    }, {});
}
