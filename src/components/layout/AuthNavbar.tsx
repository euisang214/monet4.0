"use client";

import React, { useTransition } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/Button";

export function AuthNavbar() {
    const { data: session, status } = useSession();
    const [isPending, startTransition] = useTransition();

    if (status === "loading") return null;
    if (!session?.user) return null;

    const handleLogout = () => {
        startTransition(async () => {
            await signOut({ callbackUrl: "/" });
        });
    };

    const role = session.user.role;
    const dashboardLink = role === "PROFESSIONAL"
        ? "/professional/dashboard"
        : role === "ADMIN"
            ? "/admin/dashboard"
            : "/candidate/dashboard";

    return (
        <nav style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1rem 2rem",
            backgroundColor: "#ffffff",
            borderBottom: "1px solid #e5e7eb",
            position: "sticky",
            top: 0,
            zIndex: 50,
        }}>
            <Link href={dashboardLink} style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "1.25rem",
                fontWeight: 600,
                color: "#111827",
                textDecoration: "none",
            }}>
                <span style={{ fontSize: "1.5rem" }}>🎨</span>
                Monet
            </Link>

            <div style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
            }}>
                <span style={{
                    fontSize: "0.875rem",
                    color: "#6b7280",
                }}>
                    {session.user.email}
                </span>
                <Button
                    onClick={handleLogout}
                    disabled={isPending}
                    style={{
                        backgroundColor: "#f3f4f6",
                        color: "#374151",
                        border: "none",
                        padding: "0.5rem 1rem",
                        borderRadius: "0.375rem",
                        fontSize: "0.875rem",
                        fontWeight: 500,
                        cursor: isPending ? "not-allowed" : "pointer",
                    }}
                >
                    {isPending ? "Signing out..." : "Log out"}
                </Button>
            </div>
        </nav>
    );
}
