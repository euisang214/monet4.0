import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeTrackedAction, type ExecuteTrackedActionRuntime } from '@/components/ui/actions/executeTrackedAction';

function createRuntime(): ExecuteTrackedActionRuntime {
    return {
        runTrackedRequest: vi.fn(async (runner) => {
            return runner();
        }),
        push: vi.fn(),
        replace: vi.fn(),
        refresh: vi.fn(),
    };
}

describe('executeTrackedAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns the action result without post-success side effects for same-page actions', async () => {
        const runtime = createRuntime();

        const result = await executeTrackedAction(runtime, {
            action: async () => ({ ok: true as const }),
            copy: {
                pending: { title: 'Saving', message: 'Working.' },
                success: { title: 'Saved', message: 'Done.' },
            },
            postSuccess: { kind: 'none' },
        });

        expect(result).toEqual({ ok: true });
        expect(runtime.refresh).not.toHaveBeenCalled();
        expect(runtime.push).not.toHaveBeenCalled();
        expect(runtime.replace).not.toHaveBeenCalled();
    });

    it('refreshes after a successful same-page mutation when requested', async () => {
        const runtime = createRuntime();

        await executeTrackedAction(runtime, {
            action: async () => true,
            copy: {
                pending: { title: 'Saving', message: 'Working.' },
                success: { title: 'Saved', message: 'Done.' },
            },
            postSuccess: { kind: 'refresh' },
        });

        expect(runtime.refresh).toHaveBeenCalledTimes(1);
    });

    it('passes push navigation through runTrackedRequest and executes the router callback', async () => {
        const runtime = createRuntime();
        let capturedNavigation:
            | Parameters<ExecuteTrackedActionRuntime['runTrackedRequest']>[1]['navigation']
            | undefined;

        vi.mocked(runtime.runTrackedRequest).mockImplementation(async (runner, options) => {
            capturedNavigation = options.navigation;
            return runner();
        });

        await executeTrackedAction(runtime, {
            action: async () => ({ bookingId: 'booking-1' }),
            copy: {
                pending: { title: 'Submitting', message: 'Working.' },
                success: { title: 'Submitted', message: 'Done.' },
            },
            postSuccess: {
                kind: 'push',
                href: (result) => `/candidate/bookings/${result.bookingId}`,
            },
        });

        expect(capturedNavigation?.href).toBe('/candidate/bookings/booking-1');
        await capturedNavigation?.execute();
        expect(runtime.push).toHaveBeenCalledWith('/candidate/bookings/booking-1');
    });

    it('passes replace navigation through runTrackedRequest and executes the router callback', async () => {
        const runtime = createRuntime();
        let capturedNavigation:
            | Parameters<ExecuteTrackedActionRuntime['runTrackedRequest']>[1]['navigation']
            | undefined;

        vi.mocked(runtime.runTrackedRequest).mockImplementation(async (runner, options) => {
            capturedNavigation = options.navigation;
            return runner();
        });

        await executeTrackedAction(runtime, {
            action: async () => ({ destination: '/professional/dashboard' }),
            copy: {
                pending: { title: 'Submitting', message: 'Working.' },
                success: { title: 'Submitted', message: 'Done.' },
            },
            postSuccess: {
                kind: 'replace',
                href: (result) => result.destination,
            },
        });

        expect(capturedNavigation?.href).toBe('/professional/dashboard');
        await capturedNavigation?.execute();
        expect(runtime.replace).toHaveBeenCalledWith('/professional/dashboard');
    });

    it('prefers toast overrides over default copy', async () => {
        const runtime = createRuntime();
        let capturedOptions: Parameters<ExecuteTrackedActionRuntime['runTrackedRequest']>[1] | undefined;

        vi.mocked(runtime.runTrackedRequest).mockImplementation(async (runner, options) => {
            capturedOptions = options;
            return runner();
        });

        await executeTrackedAction(runtime, {
            action: async () => true,
            copy: {
                pending: { title: 'Default pending', message: 'Default pending.' },
                success: { title: 'Default success', message: 'Default success.' },
                error: { title: 'Default error', message: 'Default error.' },
            },
            toast: {
                pending: { title: 'Override pending', message: 'Override pending.' },
                success: { title: 'Override success', message: 'Override success.' },
                error: { title: 'Override error', message: 'Override error.' },
            },
            postSuccess: { kind: 'none' },
        });

        expect(capturedOptions).toMatchObject({
            pending: { title: 'Override pending' },
            success: { title: 'Override success' },
            error: { title: 'Override error' },
        });
    });

    it('rethrows action errors after the tracked request runtime resolves the error copy', async () => {
        const runtime = createRuntime();
        const failure = new Error('Boom');
        const resolvedErrors: Array<{ title: string; message: string }> = [];

        vi.mocked(runtime.runTrackedRequest).mockImplementation(async (runner, options) => {
            try {
                return await runner();
            } catch (error) {
                const copy = typeof options.error === 'function' ? options.error(error) : options.error;
                if (copy) {
                    resolvedErrors.push(copy);
                }
                throw error;
            }
        });

        await expect(
            executeTrackedAction(runtime, {
                action: async () => {
                    throw failure;
                },
                copy: {
                    pending: { title: 'Saving', message: 'Working.' },
                    success: { title: 'Saved', message: 'Done.' },
                },
                postSuccess: { kind: 'none' },
            }),
        ).rejects.toThrow('Boom');

        expect(resolvedErrors).toEqual([
            {
                title: 'Action failed',
                message: 'Boom',
            },
        ]);
    });
});
