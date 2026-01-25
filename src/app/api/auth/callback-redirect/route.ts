import { auth } from "@/auth"
import { NextResponse } from "next/server"

/**
 * This endpoint handles post-OAuth login redirects.
 * After a successful OAuth login, NextAuth redirects here and we determine
 * the appropriate dashboard based on the user's role.
 */
export async function GET() {
    const session = await auth()

    if (!session?.user) {
        // Not authenticated, redirect to login
        return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL || "http://localhost:3000"))
    }

    const role = session.user.role

    let dashboardUrl: string
    switch (role) {
        case "CANDIDATE":
            dashboardUrl = "/candidate"
            break
        case "PROFESSIONAL":
            dashboardUrl = "/professional"
            break
        case "ADMIN":
            dashboardUrl = "/admin"
            break
        default:
            dashboardUrl = "/"
    }

    return NextResponse.redirect(new URL(dashboardUrl, process.env.NEXTAUTH_URL || "http://localhost:3000"))
}
