import { exportTableToCsv } from '@/lib/core/admin-export';
import { EXPORT_TABLE_CONFIG } from '@/lib/core/admin-export-config';
import { withRole } from '@/lib/core/api-helpers';
import { Role } from '@prisma/client';
import { NextResponse } from 'next/server';

export const GET = withRole(Role.ADMIN, async (
    _req: Request,
    context: { params: { table: string } },
) => {
    const { table } = context.params;
    const config = EXPORT_TABLE_CONFIG[table];

    if (!config) {
        return NextResponse.json({ error: 'Unknown export table' }, { status: 404 });
    }

    const queryArgs: Record<string, unknown> = { orderBy: config.orderBy };
    if (config.select) {
        queryArgs.select = config.select;
    }

    const rows = await config.delegate().findMany(queryArgs);
    const transformed = config.transform ? rows.map(config.transform) : rows;
    const csv = exportTableToCsv(transformed);

    return new Response(csv, {
        headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="${config.filename}"`,
        },
    });
});
