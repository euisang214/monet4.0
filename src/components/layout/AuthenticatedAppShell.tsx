"use client";

import { SessionProvider } from "next-auth/react";
import { AuthNavbar } from "@/components/layout/AuthNavbar";
import { RequestToastProvider } from "@/components/ui";
import styles from "./AuthenticatedAppShell.module.css";

interface AuthenticatedAppShellProps {
    children: React.ReactNode;
}

export function AuthenticatedAppShell({ children }: AuthenticatedAppShellProps) {
    return (
        <SessionProvider>
            <RequestToastProvider>
                <div className={styles.shell} data-auth-app-shell="true">
                    <AuthNavbar />
                    {children}
                </div>
            </RequestToastProvider>
        </SessionProvider>
    );
}
