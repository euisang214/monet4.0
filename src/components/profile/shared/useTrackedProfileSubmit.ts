"use client";

import { useRouter } from "next/navigation";
import { executeTrackedAction } from "@/components/ui/actions/executeTrackedAction";
import { buildErrorToastCopy, type ToastCopy } from "@/components/ui/hooks/requestToastController";
import { useTrackedRequest } from "@/components/ui/providers/RequestToastProvider";

export type ProfileAsyncStatus<TResult = unknown> = {
    pending: ToastCopy;
    success: ToastCopy | ((result: TResult) => ToastCopy);
    error?: ToastCopy | ((error: unknown) => ToastCopy);
    errorTitle?: string;
    errorMessage?: string;
    navigation?: {
        href: string;
        mode?: "push" | "replace";
    };
};

export function useTrackedProfileSubmit() {
    let router: ReturnType<typeof useRouter> | null = null;
    try {
        router = useRouter();
    } catch {
        router = null;
    }
    const { runTrackedRequest } = useTrackedRequest();

    return async function runTrackedProfileSubmit<TResult>(
        action: () => Promise<TResult>,
        asyncStatus?: ProfileAsyncStatus<TResult>,
    ): Promise<TResult | null> {
        if (!asyncStatus) {
            return action();
        }

        const navigation = asyncStatus.navigation;

        try {
            return await executeTrackedAction(
                {
                    runTrackedRequest,
                    push: router?.push || (() => undefined),
                    replace: router?.replace || (() => undefined),
                    refresh: router?.refresh || (() => undefined),
                },
                {
                    action,
                    copy: {
                        pending: asyncStatus.pending,
                        success: asyncStatus.success,
                        error: asyncStatus.error || ((error) => buildErrorToastCopy(
                            error,
                            asyncStatus.errorTitle || "Profile save failed",
                            asyncStatus.errorMessage,
                        )),
                    },
                    postSuccess: navigation
                        ? {
                              kind: navigation.mode === "replace" ? "replace" : "push",
                              href: navigation.href,
                          }
                        : { kind: "none" },
                },
            );
        } catch {
            return null;
        }
    };
}
