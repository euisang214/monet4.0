import { NextResponse } from "next/server"
import { z } from "zod"
import { AuthService } from "@/lib/domain/auth/services"

const forgotPasswordSchema = z.object({
    email: z.string().email("Invalid email address"),
})

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const result = forgotPasswordSchema.safeParse(body)

        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", details: result.error.flatten() },
                { status: 400 }
            )
        }

        const { email } = result.data

        await AuthService.requestPasswordReset(email)

        // Always return success to prevent email enumeration
        return NextResponse.json(
            { message: "If an account exists with this email, a reset link has been sent." },
            { status: 200 }
        )

    } catch (error) {
        console.error("Forgot password error:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}
