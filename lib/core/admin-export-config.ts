import { prisma } from '@/lib/core/db';

/**
 * Configuration for admin CSV exports.
 *
 * Each key is a URL slug (e.g. `/api/admin/export/bookings`).
 * - delegate: returns the Prisma model delegate to query
 * - orderBy: sort order for the findMany call
 * - select: (optional) explicit field selection (e.g. to exclude sensitive data)
 * - transform: (optional) row-level transform before CSV conversion
 * - filename: the CSV download filename
 */
export type ExportTableEntry = {
    delegate: () => { findMany: (args: any) => Promise<any[]> };
    orderBy: Record<string, string>;
    select?: Record<string, boolean>;
    transform?: (row: any) => any;
    filename: string;
};

export const EXPORT_TABLE_CONFIG: Record<string, ExportTableEntry> = {
    'audit-logs': {
        delegate: () => prisma.auditLog,
        orderBy: { createdAt: 'desc' },
        transform: (row) => ({ ...row, metadata: JSON.stringify(row.metadata) }),
        filename: 'audit_logs.csv',
    },
    'bookings': {
        delegate: () => prisma.booking,
        orderBy: { startAt: 'desc' },
        filename: 'bookings.csv',
    },
    'disputes': {
        delegate: () => prisma.dispute,
        orderBy: { createdAt: 'desc' },
        filename: 'disputes.csv',
    },
    'feedback': {
        delegate: () => prisma.callFeedback,
        orderBy: { submittedAt: 'desc' },
        transform: (row) => ({ ...row, actions: row.actions.join('; ') }),
        filename: 'feedback.csv',
    },
    'payments': {
        delegate: () => prisma.payment,
        orderBy: { createdAt: 'desc' },
        filename: 'payments.csv',
    },
    'payouts': {
        delegate: () => prisma.payout,
        orderBy: { createdAt: 'desc' },
        filename: 'payouts.csv',
    },
    'users': {
        delegate: () => prisma.user,
        orderBy: { email: 'asc' },
        select: {
            id: true,
            email: true,
            role: true,
            googleCalendarConnected: true,
            linkedinConnected: true,
            corporateEmailVerified: true,
            timezone: true,
            stripeCustomerId: true,
            stripeAccountId: true,
        },
        filename: 'users.csv',
    },
};
