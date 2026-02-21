import { auth } from "@/auth"
import { Role } from "@prisma/client"
import { redirect } from "next/navigation"
import { NextResponse } from "next/server"
import { TransitionConflictError, TransitionError } from "@/lib/domain/bookings/errors"

function isOnboardingBlocked(user: {
    role: Role
    onboardingRequired?: boolean
    onboardingCompleted?: boolean
}) {
    if (user.role !== Role.CANDIDATE && user.role !== Role.PROFESSIONAL) {
        return false
    }

    return user.onboardingRequired === true && user.onboardingCompleted !== true
}

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
    if (isOnboardingBlocked(user)) {
        redirect("/onboarding")
    }
    return user
}

type ApiHandler<TArgs extends unknown[] = unknown[]> = (req: Request, ...args: TArgs) => Promise<Response> | Response

export function withRole<TArgs extends unknown[]>(role: Role, handler: ApiHandler<TArgs>) {
    return async (req: Request, ...args: TArgs): Promise<Response> => {
        const session = await auth()
        const user = session?.user

        if (!user || user.role !== role) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }
        if (isOnboardingBlocked(user)) {
            return NextResponse.json({ error: "onboarding_required" }, { status: 403 })
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
        ) as TArgs

        return handler(req, ...normalizedArgs)
    }
}

export function getErrorStatus(error: unknown, fallbackStatus: number) {
    if (error instanceof TransitionConflictError) {
        return 409
    }

    if (error instanceof TransitionError) {
        return 400
    }

    return fallbackStatus
}

export function getErrorMessage(error: unknown, fallbackMessage: string) {
    return error instanceof Error ? error.message : fallbackMessage
}
