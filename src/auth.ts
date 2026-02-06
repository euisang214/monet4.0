import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import LinkedIn from "next-auth/providers/linkedin"
import { z } from "zod"
import { prisma } from "@/lib/core/db"
import bcrypt from "bcryptjs"
import { Role } from "@prisma/client"

const authSecret = process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim()

if (!authSecret) {
    throw new Error("Missing AUTH_SECRET or NEXTAUTH_SECRET in environment.")
}

export const { handlers, auth, signIn, signOut } = NextAuth({
    secret: authSecret,
    providers: [
        Google({
            authorization: {
                params: {
                    scope: "openid email profile https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events",
                    access_type: "offline",
                    prompt: "consent",
                },
            },
        }),
        LinkedIn,
        Credentials({
            name: "credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            authorize: async (credentials) => {
                const parsedCredentials = z
                    .object({ email: z.string().email(), password: z.string().min(6) })
                    .safeParse(credentials)

                if (parsedCredentials.success) {
                    const { email, password } = parsedCredentials.data
                    const user = await prisma.user.findUnique({
                        where: { email },
                    })

                    if (!user || !user.hashedPassword) return null

                    const passwordsMatch = await bcrypt.compare(password, user.hashedPassword)

                    if (passwordsMatch) return user
                }

                return null
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id
                token.role = user.role
            }
            return token
        },
        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = token.id as string
                session.user.role = token.role as Role
            }
            return session
        },
    },
    session: { strategy: "jwt" },
    pages: {
        signIn: "/login",
    },
})
