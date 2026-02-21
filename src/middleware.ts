import { getToken } from "next-auth/jwt"
import { NextRequest, NextResponse } from "next/server"

type AppRole = "CANDIDATE" | "PROFESSIONAL" | "ADMIN"

const protectedRolePrefixes: Array<{ prefix: string; role: AppRole }> = [
    { prefix: "/candidate", role: "CANDIDATE" },
    { prefix: "/professional", role: "PROFESSIONAL" },
    { prefix: "/admin", role: "ADMIN" },
]

export async function middleware(req: NextRequest) {
    const pathname = req.nextUrl.pathname
    const protectedRoute = protectedRolePrefixes.find(({ prefix }) => pathname.startsWith(prefix))

    if (!protectedRoute) {
        return NextResponse.next()
    }

    const token = await getToken({
        req,
        secret: process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim(),
    })

    if (!token) {
        return NextResponse.redirect(new URL("/api/auth/signin", req.nextUrl))
    }

    if (token.role !== protectedRoute.role) {
        return NextResponse.redirect(new URL("/", req.nextUrl))
    }

    const isOnboardingRole = token.role === "CANDIDATE" || token.role === "PROFESSIONAL"
    const onboardingRequired = token.onboardingRequired === true
    const onboardingCompleted = token.onboardingCompleted === true
    if (isOnboardingRole && onboardingRequired && !onboardingCompleted) {
        return NextResponse.redirect(new URL("/onboarding", req.nextUrl))
    }

    return NextResponse.next()
}

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
