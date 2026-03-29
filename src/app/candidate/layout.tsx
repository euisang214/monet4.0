import { AuthenticatedContentFrame } from "@/components/layout/AuthenticatedContentFrame";

export default function CandidateLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return <AuthenticatedContentFrame>{children}</AuthenticatedContentFrame>;
}
