"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { RequestToast } from "@/components/ui/composites/RequestToast/RequestToast";
import {
    buildErrorToastCopy,
    createRequestToastController,
    getToastAutoDismissMs,
    normalizeNavigationPath,
    resolveToastCopy,
    type RequestToastNavigation,
    type RequestToastState,
    type RequestToastTone,
    type ToastCopy,
    type TrackedRequestOptions,
} from "@/components/ui/hooks/requestToastController";

export interface RequestToastContextValue {
    runTrackedRequest: <T>(runner: () => Promise<T>, options: TrackedRequestOptions<T>) => Promise<T>;
    showToast: (tone: RequestToastTone, copy: ToastCopy) => void;
    dismissToast: () => void;
    navigateWithToast: (copy: ToastCopy, navigation: Omit<RequestToastNavigation, "execute">) => void;
    currentToast: RequestToastState | null;
}

const defaultRequestToastContext: RequestToastContextValue = {
    runTrackedRequest: async <T,>(runner: () => Promise<T>) => runner(),
    showToast: () => undefined,
    dismissToast: () => undefined,
    navigateWithToast: () => undefined,
    currentToast: null,
};

const RequestToastContext = createContext<RequestToastContextValue>(defaultRequestToastContext);

interface RequestToastProviderProps {
    children: React.ReactNode;
}

export function RequestToastProvider({ children }: RequestToastProviderProps) {
    const pathname = usePathname() || "/";
    const router = useRouter();
    const controllerRef = useRef(createRequestToastController(pathname));
    const timeoutRef = useRef<number | null>(null);
    const pathnameRef = useRef(pathname);
    const [currentToast, setCurrentToast] = useState<RequestToastState | null>(null);

    const clearDismissTimer = useCallback(() => {
        if (timeoutRef.current !== null) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    const commitToast = useCallback((nextToast: RequestToastState | null) => {
        clearDismissTimer();
        setCurrentToast(nextToast ? { ...nextToast } : null);

        if (!nextToast) return;

        const dismissMs = getToastAutoDismissMs(nextToast.tone);
        if (dismissMs === null) return;

        timeoutRef.current = window.setTimeout(() => {
            setCurrentToast(controllerRef.current.dismiss());
            timeoutRef.current = null;
        }, dismissMs);
    }, [clearDismissTimer]);

    useEffect(() => {
        pathnameRef.current = pathname;
        commitToast(controllerRef.current.syncPathname(pathname));
    }, [commitToast, pathname]);

    useEffect(() => () => clearDismissTimer(), [clearDismissTimer]);

    const dismissToast = useCallback(() => {
        commitToast(controllerRef.current.dismiss());
    }, [commitToast]);

    const showToast = useCallback((tone: RequestToastTone, copy: ToastCopy) => {
        commitToast(controllerRef.current.showToast(tone, copy));
    }, [commitToast]);

    const runTrackedRequest = useCallback(async <T,>(runner: () => Promise<T>, options: TrackedRequestOptions<T>) => {
        const { requestId } = controllerRef.current.startRequest(options.pending);
        commitToast(controllerRef.current.getState());

        try {
            const result = await runner();
            const successCopy = resolveToastCopy(options.success, result);

            if (options.navigation) {
                const targetPath = normalizeNavigationPath(options.navigation.href);
                await options.navigation.execute();
                commitToast(controllerRef.current.resolveRequestSuccess(requestId, successCopy, targetPath));
                commitToast(controllerRef.current.syncPathname(pathnameRef.current));
            } else {
                commitToast(controllerRef.current.resolveRequestSuccess(requestId, successCopy));
            }

            return result;
        } catch (error) {
            const errorCopy = resolveToastCopy(
                options.error,
                error,
            ) || buildErrorToastCopy(error);
            commitToast(controllerRef.current.resolveRequestError(requestId, errorCopy));
            throw error;
        }
    }, [commitToast]);

    const navigateWithToast = useCallback((copy: ToastCopy, navigation: Omit<RequestToastNavigation, "execute">) => {
        const execute = navigation.mode === "replace"
            ? () => router.replace(navigation.href)
            : () => router.push(navigation.href);

        void runTrackedRequest(
            async () => true,
            {
                pending: copy,
                success: copy,
                error: buildErrorToastCopy(new Error(copy.message)),
                navigation: {
                    ...navigation,
                    execute,
                },
            },
        );
    }, [router, runTrackedRequest]);

    const value = useMemo<RequestToastContextValue>(() => ({
        runTrackedRequest,
        showToast,
        dismissToast,
        navigateWithToast,
        currentToast,
    }), [currentToast, dismissToast, navigateWithToast, runTrackedRequest, showToast]);

    return (
        <RequestToastContext.Provider value={value}>
            {children}
            <RequestToast toast={currentToast} onDismiss={dismissToast} />
        </RequestToastContext.Provider>
    );
}

export function useTrackedRequest() {
    return useContext(RequestToastContext);
}
