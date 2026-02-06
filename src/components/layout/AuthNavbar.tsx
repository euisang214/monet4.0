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
        <nav className="container" style={{ position: "sticky", top: "0.85rem", zIndex: 40, marginBottom: "0.6rem" }}>
            <div className="bg-white border border-gray-200 shadow-sm rounded-lg px-4 py-3 flex items-center justify-between">
                <Link href={dashboardLink} className="flex items-center gap-2 font-semibold text-gray-900">
                    <span
                        style={{
                            width: "24px",
                            height: "24px",
                            display: "inline-block",
                            borderRadius: "7px",
                            background: "linear-gradient(135deg, #0b57d0, #14b8a6)",
                        }}
                    />
                    Monet
                </Link>

                <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500">{session.user.email}</span>
                    <Button onClick={handleLogout} disabled={isPending} className="bg-gray-100 text-gray-800 hover:bg-gray-200">
                        {isPending ? "Signing out..." : "Log out"}
                    </Button>
                </div>
            </div>
        </nav>
    );
}
