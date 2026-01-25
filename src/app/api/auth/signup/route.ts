import { NextResponse } from "next/server"
import { z } from "zod"
import { AuthService } from "@/lib/domain/auth/services"
import { Role } from "@prisma/client"

const signupSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    role: z.enum([Role.CANDIDATE, Role.PROFESSIONAL]),
    name: z.string().min(1, "Name is required"),
})

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const result = signupSchema.safeParse(body)

        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", details: result.error.flatten() },
                { status: 400 }
            )
        }

        const { email, password, role, name } = result.data

        const newUser = await AuthService.createUser(email, password, role, name)

        return NextResponse.json(
            {
                message: "User created successfully",
                user: { id: newUser.id, email: newUser.email, role: newUser.role }
            },
            { status: 201 }
        )

    } catch (error: unknown) {
        console.error("Signup error:", error)

        if (error instanceof Error && error.message === "Email already registered") {
            return NextResponse.json(
                { error: "Email already registered" },
                { status: 409 }
            )
        }

        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}
