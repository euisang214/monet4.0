import { AdminUserService } from '@/lib/role/admin/users';
import { DataTable, EmptyState, PageHeader, type DataColumn, StatusBadge } from '@/components/ui';
import { appRoutes } from '@/lib/shared/routes';
import { buttonVariants } from '@/components/ui/primitives/Button';

export const dynamic = 'force-dynamic';

type UserRow = Awaited<ReturnType<typeof AdminUserService.listUsers>>[number];

function roleBadgeVariant(role: string) {
    if (role === 'ADMIN') return 'info' as const;
    if (role === 'PROFESSIONAL') return 'success' as const;
    return 'neutral' as const;
}

const columns: DataColumn<UserRow>[] = [
    {
        key: 'email',
        header: 'Email',
        cell: (user) => <span className="font-medium text-gray-900">{user.email}</span>,
        priority: 'primary',
    },
    {
        key: 'role',
        header: 'Role',
        cell: (user) => <StatusBadge label={user.role} variant={roleBadgeVariant(user.role)} />,
    },
    {
        key: 'status',
        header: 'Status',
        cell: (user) =>
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
            <PageHeader
                eyebrow="Admin users"
                title="Users"
                description="Audit account roles and corporate verification status."
                actions={
                    <a href={appRoutes.api.admin.usersExport} className={buttonVariants({ variant: 'secondary' })}>
                    Export CSV
                    </a>
                }
            />

            <DataTable
                columns={columns}
                data={users}
                getRowKey={(user) => user.id}
                density="compact"
                emptyState={
                    <EmptyState
                        title="No users found."
                        description="There are no users matching the current data set."
                        badge="Queue empty"
                        layout="inline"
                    />
                }
            />
        </div>
    );
}
