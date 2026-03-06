import { AuthenticatedContentFrame } from "@/components/layout/AuthenticatedContentFrame";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <AuthenticatedContentFrame>{children}</AuthenticatedContentFrame>;
}
