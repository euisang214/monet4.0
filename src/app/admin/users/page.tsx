import { AdminUserService } from '@/lib/role/admin/users';
import { AdminDataTable, type Column } from '@/components/ui/composites/AdminDataTable';
import { StatusBadge } from '@/components/ui/composites/StatusBadge';
import { appRoutes } from '@/lib/shared/routes';

export const dynamic = 'force-dynamic';

type UserRow = Awaited<ReturnType<typeof AdminUserService.listUsers>>[number];

function roleBadgeVariant(role: string) {
    if (role === 'ADMIN') return 'info' as const;
    if (role === 'PROFESSIONAL') return 'success' as const;
    return 'neutral' as const;
}

const columns: Column<UserRow>[] = [
    {
        header: 'Email',
        accessor: (user) => <span className="font-medium text-gray-900">{user.email}</span>,
    },
    {
        header: 'Role',
        accessor: (user) => <StatusBadge label={user.role} variant={roleBadgeVariant(user.role)} />,
    },
    {
        header: 'Status',
        accessor: (user) =>
            user.corporateEmailVerified && user.role === 'PROFESSIONAL' ? (
                <span className="text-green-600 flex items-center gap-1">Verified</span>
            ) : (
                '-'
            ),
    },
];

export default async function UsersPage() {
    const users = await AdminUserService.listUsers(100);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">Users</h1>
                <a
                    href={appRoutes.api.admin.usersExport}
                    className="px-4 py-2 bg-white border border-gray-300 rounded shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                    Export CSV
                </a>
            </div>

            <AdminDataTable
                columns={columns}
                data={users}
                getRowKey={(user) => user.id}
                emptyMessage="No users found."
            />
        </div>
    );
}
