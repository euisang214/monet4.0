import { auth } from "@/auth"
import { Role } from "@prisma/client"
import { redirect } from "next/navigation"
import { NextResponse } from "next/server"

export async function currentUser() {
    const session = await auth()
    return session?.user
}

export async function requireAuth(callbackUrl?: string) {
    const user = await currentUser()
    if (!user) {
        redirect(callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/login")
    }
    return user
}

export async function requireRole(role: Role, callbackUrl?: string) {
    const user = await requireAuth(callbackUrl)
    if (user.role !== role) {
        redirect("/")
    }
    return user
}

type ApiHandler = (req: Request, ...args: unknown[]) => Promise<Response> | Response

export function withRole(role: Role, handler: ApiHandler) {
    return async (req: Request, ...args: unknown[]) => {
        const session = await auth()
        const user = session?.user

        if (!user || user.role !== role) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const normalizedArgs = await Promise.all(
            args.map(async (arg) => {
                if (!arg || typeof arg !== "object" || !("params" in arg)) {
                    return arg
                }

                const context = arg as { params?: unknown }
                return {
                    ...context,
                    params: await Promise.resolve(context.params),
                }
            })
        )

        return handler(req, ...normalizedArgs)
    }
}
