import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { Role } from "@prisma/client"

export default auth((req) => {
    const isLoggedIn = !!req.auth
    const user = req.auth?.user
    const nextUrl = req.nextUrl
    const pathname = nextUrl.pathname

    if (pathname.startsWith("/candidate")) {
        if (!isLoggedIn) {
            return NextResponse.redirect(new URL("/api/auth/signin", nextUrl))
        }
        if (user?.role !== "CANDIDATE") {
            return NextResponse.redirect(new URL("/", nextUrl))
        }
    }

    if (pathname.startsWith("/professional")) {
        if (!isLoggedIn) {
            return NextResponse.redirect(new URL("/api/auth/signin", nextUrl))
        }
        if (user?.role !== "PROFESSIONAL") {
            return NextResponse.redirect(new URL("/", nextUrl))
        }
    }

    if (pathname.startsWith("/admin")) {
        if (!isLoggedIn) {
            return NextResponse.redirect(new URL("/api/auth/signin", nextUrl))
        }
        if (user?.role !== "ADMIN") {
            return NextResponse.redirect(new URL("/", nextUrl))
        }
    }

    return NextResponse.next()
})

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
