import { AuthenticatedAppShell } from "@/components/layout/AuthenticatedAppShell";
import { AuthenticatedContentFrame } from "@/components/layout/AuthenticatedContentFrame";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AuthenticatedAppShell>
            <AuthenticatedContentFrame>{children}</AuthenticatedContentFrame>
        </AuthenticatedAppShell>
    );
}
