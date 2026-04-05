"use client";

import { SessionProvider } from "next-auth/react";
import { AuthNavbar } from "@/components/layout/AuthNavbar";
import { RequestToastProvider } from "@/components/ui";

interface AuthenticatedAppShellProps {
    children: React.ReactNode;
}

export function AuthenticatedAppShell({ children }: AuthenticatedAppShellProps) {
    return (
        <SessionProvider>
            <RequestToastProvider>
                <AuthNavbar />
                {children}
            </RequestToastProvider>
        </SessionProvider>
    );
}
