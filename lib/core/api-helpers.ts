import { auth } from "@/auth"
import { Role } from "@prisma/client"
import { redirect } from "next/navigation"
import { NextResponse } from "next/server"

export async function currentUser() {
    const session = await auth()
    return session?.user
}

export async function requireAuth() {
    const user = await currentUser()
    if (!user) {
        redirect("/api/auth/signin")
    }
    return user
}

export async function requireRole(role: Role) {
    const user = await requireAuth()
    if (user.role !== role) {
        redirect("/")
    }
    return user
}

type ApiHandler = (req: Request, ...args: any[]) => Promise<Response> | Response

export function withRole(role: Role, handler: ApiHandler) {
    return async (req: Request, ...args: any[]) => {
        const session = await auth()
        const user = session?.user

        if (!user || user.role !== role) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        return handler(req, ...args)
    }
}
