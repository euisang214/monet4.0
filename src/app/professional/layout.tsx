import { AuthenticatedAppShell } from "@/components/layout/AuthenticatedAppShell";
import { AuthenticatedContentFrame } from "@/components/layout/AuthenticatedContentFrame";

export default function ProfessionalLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <AuthenticatedAppShell>
            <AuthenticatedContentFrame>{children}</AuthenticatedContentFrame>
        </AuthenticatedAppShell>
    );
}
