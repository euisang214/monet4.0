import { prisma } from '@/lib/core/db';
import { sendPasswordResetEmail } from '@/lib/integrations/email';
import { Prisma, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

async function createRoleProfile(
    tx: Prisma.TransactionClient,
    userId: string,
    role: Role,
    email: string,
    resumeUrl?: string
) {
    if (role === Role.PROFESSIONAL) {
        await tx.professionalProfile.create({
            data: {
                userId,
                employer: '',
                title: '',
                bio: '',
                priceCents: 0,
                corporateEmail: email,
            },
        });
        return;
    }

    if (role === Role.CANDIDATE) {
        await tx.candidateProfile.create({
            data: {
                userId,
                resumeUrl,
            },
        });
    }
}

export const AuthService = {
    /**
     * Creates a new user with the appropriate profile based on role.
     * Uses a transaction to ensure user and profile are created atomically.
     */
    async createUser(
        email: string,
        password: string,
        role: Role,
        _name: string,
        resumeUrl?: string
    ) {
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            throw new Error('Email already registered');
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.$transaction(async (tx) => {
            const newUser = await tx.user.create({
                data: {
                    email,
                    hashedPassword,
                    role,
                    onboardingRequired: true,
                    onboardingCompleted: false,
                },
            });

            await createRoleProfile(tx, newUser.id, role, email, resumeUrl);

            return newUser;
        });

        return user;
    },

    /**
     * Creates a new OAuth-backed user. The account is onboarding-required until
     * required role fields are submitted through the onboarding flow.
     */
    async createOAuthUser(email: string, role: Role) {
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return existingUser;
        }

        const user = await prisma.$transaction(async (tx) => {
            const newUser = await tx.user.create({
                data: {
                    email,
                    role,
                    onboardingRequired: true,
                    onboardingCompleted: false,
                },
            });

            await createRoleProfile(tx, newUser.id, role, email);
            return newUser;
        });

        return user;
    },

    /**
     * Initiates password reset by creating a token and sending email.
     * Returns void regardless of whether user exists (prevents email enumeration).
     */
    async requestPasswordReset(email: string) {
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            // Silent return to prevent email enumeration
            return;
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await prisma.passwordResetToken.create({
            data: {
                userId: user.id,
                token,
                expiresAt,
            },
        });

        await sendPasswordResetEmail(email, token);
    },

    /**
     * Validates reset token and updates password.
     * Deletes token after successful reset.
     */
    async resetPassword(token: string, newPassword: string) {
        const resetToken = await prisma.passwordResetToken.findUnique({
            where: { token },
        });

        if (!resetToken) {
            throw new Error('Invalid or expired token');
        }

        if (resetToken.expiresAt < new Date()) {
            await prisma.passwordResetToken.delete({ where: { token } });
            throw new Error('Invalid or expired token');
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.$transaction([
            prisma.user.update({
                where: { id: resetToken.userId },
                data: { hashedPassword },
            }),
            prisma.passwordResetToken.delete({
                where: { id: resetToken.id },
            }),
        ]);
    },
};
