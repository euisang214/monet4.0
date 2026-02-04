import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Role } from '@prisma/client';

// Use vi.hoisted to ensure mocks are created before module loading
const mockPrisma = vi.hoisted(() => ({
    user: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
    },
    candidateProfile: {
        create: vi.fn(),
    },
    professionalProfile: {
        create: vi.fn(),
    },
    passwordResetToken: {
        create: vi.fn(),
        findUnique: vi.fn(),
        delete: vi.fn(),
    },
    $transaction: vi.fn(),
}));

vi.mock('@/lib/core/db', () => ({
    prisma: mockPrisma,
}));

// Mock email integration
vi.mock('@/lib/integrations/email', () => ({
    sendPasswordResetEmail: vi.fn(),
}));

// Mock bcrypt
vi.mock('bcryptjs', () => ({
    default: {
        hash: vi.fn((password: string) => Promise.resolve(`hashed_${password}`)),
        compare: vi.fn(),
    },
}));

import { AuthService } from '@/lib/domain/auth/services';
import { sendPasswordResetEmail } from '@/lib/integrations/email';
import bcrypt from 'bcryptjs';

describe('AuthService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('createUser', () => {
        it('should create a CANDIDATE with candidateProfile', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(null);

            const mockUser = { id: 'user123', email: 'test@test.com', role: Role.CANDIDATE };
            mockPrisma.$transaction.mockImplementation(async (callback) => {
                const tx = {
                    user: { create: vi.fn().mockResolvedValue(mockUser) },
                    candidateProfile: { create: vi.fn().mockResolvedValue({}) },
                    professionalProfile: { create: vi.fn() },
                };
                return callback(tx);
            });

            const result = await AuthService.createUser('test@test.com', 'password123', Role.CANDIDATE, 'Test User');

            expect(result).toEqual(mockUser);
            expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
        });

        it('should create a PROFESSIONAL with professionalProfile', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(null);

            const mockUser = { id: 'pro123', email: 'pro@test.com', role: Role.PROFESSIONAL };
            mockPrisma.$transaction.mockImplementation(async (callback) => {
                const tx = {
                    user: { create: vi.fn().mockResolvedValue(mockUser) },
                    candidateProfile: { create: vi.fn() },
                    professionalProfile: { create: vi.fn().mockResolvedValue({}) },
                };
                return callback(tx);
            });

            const result = await AuthService.createUser('pro@test.com', 'password123', Role.PROFESSIONAL, 'Pro User');

            expect(result).toEqual(mockUser);
        });

        it('should throw on duplicate email', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing', email: 'test@test.com' });

            await expect(
                AuthService.createUser('test@test.com', 'password123', Role.CANDIDATE, 'Test')
            ).rejects.toThrow('Email already registered');
        });

        it('should hash password correctly', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(null);
            mockPrisma.$transaction.mockImplementation(async (callback) => {
                const tx = {
                    user: { create: vi.fn().mockResolvedValue({ id: 'user1' }) },
                    candidateProfile: { create: vi.fn() },
                    professionalProfile: { create: vi.fn() },
                };
                return callback(tx);
            });

            await AuthService.createUser('test@test.com', 'mypassword', Role.CANDIDATE, 'Test');

            expect(bcrypt.hash).toHaveBeenCalledWith('mypassword', 10);
        });
    });

    describe('requestPasswordReset', () => {
        it('should create token and send email for existing user', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({ id: 'user1', email: 'test@test.com' });
            mockPrisma.passwordResetToken.create.mockResolvedValue({});

            await AuthService.requestPasswordReset('test@test.com');

            expect(mockPrisma.passwordResetToken.create).toHaveBeenCalled();
            expect(sendPasswordResetEmail).toHaveBeenCalledWith('test@test.com', expect.any(String));
        });

        it('should silently return for non-existent user (prevent email enumeration)', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(null);

            await AuthService.requestPasswordReset('nonexistent@test.com');

            expect(mockPrisma.passwordResetToken.create).not.toHaveBeenCalled();
            expect(sendPasswordResetEmail).not.toHaveBeenCalled();
        });
    });

    describe('resetPassword', () => {
        it('should update password with valid token', async () => {
            const mockToken = {
                id: 'token1',
                userId: 'user1',
                token: 'valid-token',
                expiresAt: new Date(Date.now() + 60000),
            };
            mockPrisma.passwordResetToken.findUnique.mockResolvedValue(mockToken);
            mockPrisma.$transaction.mockResolvedValue([]);

            await AuthService.resetPassword('valid-token', 'newpassword');

            expect(bcrypt.hash).toHaveBeenCalledWith('newpassword', 10);
            expect(mockPrisma.$transaction).toHaveBeenCalled();
        });

        it('should throw on invalid token', async () => {
            mockPrisma.passwordResetToken.findUnique.mockResolvedValue(null);

            await expect(
                AuthService.resetPassword('invalid-token', 'newpassword')
            ).rejects.toThrow('Invalid or expired token');
        });

        it('should throw on expired token', async () => {
            const expiredToken = {
                id: 'token1',
                userId: 'user1',
                token: 'expired-token',
                expiresAt: new Date(Date.now() - 60000), // 1 minute ago
            };
            mockPrisma.passwordResetToken.findUnique.mockResolvedValue(expiredToken);
            mockPrisma.passwordResetToken.delete.mockResolvedValue({});

            await expect(
                AuthService.resetPassword('expired-token', 'newpassword')
            ).rejects.toThrow('Invalid or expired token');

            expect(mockPrisma.passwordResetToken.delete).toHaveBeenCalledWith({ where: { token: 'expired-token' } });
        });
    });
});
