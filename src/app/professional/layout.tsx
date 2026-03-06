import { AuthenticatedContentFrame } from "@/components/layout/AuthenticatedContentFrame";

export default function ProfessionalLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return <AuthenticatedContentFrame>{children}</AuthenticatedContentFrame>;
}
