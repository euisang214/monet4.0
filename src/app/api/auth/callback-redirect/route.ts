import { auth } from "@/auth"
import { NextResponse } from "next/server"

/**
 * This endpoint handles post-OAuth login redirects.
 * After a successful OAuth login, NextAuth redirects here and we determine
 * the appropriate landing page based on the user's role.
 */
export async function GET() {
    const session = await auth()

    if (!session?.user) {
        // Not authenticated, redirect to login
        return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL || "http://localhost:3000"))
    }

    const role = session.user.role

    let redirectUrl: string
    switch (role) {
        case "CANDIDATE":
            redirectUrl = "/candidate/browse"
            break
        case "PROFESSIONAL":
            redirectUrl = "/professional/dashboard"
            break
        case "ADMIN":
            redirectUrl = "/admin/bookings"
            break
        default:
            redirectUrl = "/"
    }

    return NextResponse.redirect(new URL(redirectUrl, process.env.NEXTAUTH_URL || "http://localhost:3000"))
}
