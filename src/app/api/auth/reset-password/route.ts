import { NextResponse } from "next/server"
import { z } from "zod"
import { AuthService } from "@/lib/domain/auth/services"

const resetPasswordSchema = z.object({
    token: z.string().min(1, "Token is required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
})

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const result = resetPasswordSchema.safeParse(body)

        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", details: result.error.flatten() },
                { status: 400 }
            )
        }

        const { token, password } = result.data

        await AuthService.resetPassword(token, password)

        return NextResponse.json(
            { message: "Password updated successfully" },
            { status: 200 }
        )

    } catch (error: unknown) {
        console.error("Reset password error:", error)

        if (error instanceof Error && error.message === "Invalid or expired token") {
            return NextResponse.json(
                { error: "Invalid or expired token" },
                { status: 400 }
            )
        }

        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}
