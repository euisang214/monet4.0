export type RequestToastTone = "loading" | "success" | "error" | "warning";

export interface ToastCopy {
    title: string;
    message: string;
    actionLabel?: string;
    actionHref?: string;
}

export interface RequestToastState {
    id: number;
    tone: RequestToastTone;
    copy: ToastCopy;
    pendingNavigationPath?: string;
    successCopy?: ToastCopy;
}

export interface RequestToastNavigation {
    href: string;
    mode?: "push" | "replace";
    execute: () => void | Promise<void>;
}

export interface TrackedRequestOptions<T> {
    pending: ToastCopy;
    success: ToastCopy | ((result: T) => ToastCopy);
    error: ToastCopy | ((error: unknown) => ToastCopy);
    navigation?: RequestToastNavigation;
}

export function normalizeNavigationPath(href: string, origin = "http://localhost") {
    const normalizedHref = /^https?:\/\//.test(href)
        ? href
        : href.startsWith("/")
            ? href
            : `/${href}`;
    return new URL(normalizedHref, origin).pathname;
}

export function resolveToastCopy<T>(
    copy: ToastCopy | ((value: T) => ToastCopy),
    value: T,
) {
    return typeof copy === "function" ? copy(value) : copy;
}

export function buildErrorToastCopy(
    error: unknown,
    fallbackTitle = "Action failed",
    fallbackMessage = "Something went wrong. Please try again.",
): ToastCopy {
    if (error instanceof Error && error.message.trim()) {
        return {
            title: fallbackTitle,
            message: error.message,
        };
    }

    return {
        title: fallbackTitle,
        message: fallbackMessage,
    };
}

export function getToastAutoDismissMs(tone: RequestToastTone) {
    if (tone === "success") return 4_000;
    if (tone === "warning" || tone === "error") return 6_000;
    return null;
}

export function createRequestToastController(initialPathname = "/") {
    let pathname = initialPathname;
    let currentToast: RequestToastState | null = null;
    let activeRequestId = 0;

    const getState = () => currentToast;

    const startRequest = (copy: ToastCopy) => {
        activeRequestId += 1;
        currentToast = {
            id: activeRequestId,
            tone: "loading",
            copy,
        };

        return {
            requestId: activeRequestId,
            state: currentToast,
        };
    };

    const resolveRequestSuccess = (
        requestId: number,
        successCopy: ToastCopy,
        navigationPath?: string,
    ) => {
        if (requestId !== activeRequestId) {
            return currentToast;
        }

        if (navigationPath && navigationPath !== pathname) {
            currentToast = currentToast
                ? {
                      ...currentToast,
                      pendingNavigationPath: navigationPath,
                      successCopy,
                  }
                : {
                      id: requestId,
                      tone: "loading",
                      copy: successCopy,
                      pendingNavigationPath: navigationPath,
                      successCopy,
                  };

            return currentToast;
        }

        currentToast = {
            id: requestId,
            tone: "success",
            copy: successCopy,
        };

        return currentToast;
    };

    const resolveRequestError = (requestId: number, errorCopy: ToastCopy) => {
        if (requestId !== activeRequestId) {
            return currentToast;
        }

        currentToast = {
            id: requestId,
            tone: "error",
            copy: errorCopy,
        };

        return currentToast;
    };

    const showToast = (tone: RequestToastTone, copy: ToastCopy) => {
        activeRequestId += 1;
        currentToast = {
            id: activeRequestId,
            tone,
            copy,
        };

        return currentToast;
    };

    const syncPathname = (nextPathname: string) => {
        pathname = nextPathname;

        if (!currentToast?.pendingNavigationPath) {
            return currentToast;
        }

        if (currentToast.pendingNavigationPath !== nextPathname || !currentToast.successCopy) {
            return currentToast;
        }

        currentToast = {
            id: currentToast.id,
            tone: "success",
            copy: currentToast.successCopy,
        };

        return currentToast;
    };

    const dismiss = () => {
        currentToast = null;
        return currentToast;
    };

    return {
        getState,
        startRequest,
        resolveRequestSuccess,
        resolveRequestError,
        showToast,
        syncPathname,
        dismiss,
    };
}
