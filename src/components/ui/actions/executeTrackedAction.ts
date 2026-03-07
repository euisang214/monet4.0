"use client";

import { buildErrorToastCopy, type ToastCopy } from "@/components/ui/hooks/requestToastController";
import type { RequestToastContextValue } from "@/components/ui/providers/RequestToastProvider";

export type TrackedPostSuccess<TResult> =
    | { kind: "none" }
    | { kind: "refresh" }
    | { kind: "push"; href: string | ((result: TResult) => string) }
    | { kind: "replace"; href: string | ((result: TResult) => string) };

export interface TrackedActionCopy<TResult> {
    pending: ToastCopy;
    success: ToastCopy | ((result: TResult) => ToastCopy);
    error?: ToastCopy | ((error: unknown) => ToastCopy);
}

export interface ActionToastOverride<TResult> {
    pending?: ToastCopy;
    success?: ToastCopy | ((result: TResult) => ToastCopy);
    error?: ToastCopy | ((error: unknown) => ToastCopy);
}

export interface ExecuteTrackedActionRuntime {
    runTrackedRequest: RequestToastContextValue["runTrackedRequest"];
    push: (href: string) => void;
    replace: (href: string) => void;
    refresh: () => void;
}

interface ExecuteTrackedActionConfig<TResult> {
    action: () => Promise<TResult>;
    copy: TrackedActionCopy<TResult>;
    toast?: ActionToastOverride<TResult>;
    postSuccess?: TrackedPostSuccess<TResult>;
}

function resolveHref<TResult>(
    href: string | ((result: TResult) => string),
    result: TResult,
) {
    return typeof href === "function" ? href(result) : href;
}

export async function executeTrackedAction<TResult>(
    runtime: ExecuteTrackedActionRuntime,
    config: ExecuteTrackedActionConfig<TResult>,
) {
    const postSuccess = config.postSuccess || { kind: "none" };
    let settledResult: TResult | null = null;
    const resolvePostSuccessHref = () => {
        if (settledResult === null) {
            throw new Error("Tracked navigation target was resolved before the action completed.");
        }

        if (postSuccess.kind !== "push" && postSuccess.kind !== "replace") {
            throw new Error("Tracked navigation target requested for a non-navigation action.");
        }

        return resolveHref(postSuccess.href, settledResult);
    };

    const navigation = postSuccess.kind === "push"
        ? {
              get href() {
                  return resolvePostSuccessHref();
              },
              execute: () => runtime.push(resolvePostSuccessHref()),
          }
        : postSuccess.kind === "replace"
            ? {
                  get href() {
                      return resolvePostSuccessHref();
                  },
                  execute: () => runtime.replace(resolvePostSuccessHref()),
              }
            : undefined;

    const result = await runtime.runTrackedRequest(
        async () => {
            const nextResult = await config.action();
            settledResult = nextResult;
            return nextResult;
        },
        {
            pending: config.toast?.pending || config.copy.pending,
            success: config.toast?.success || config.copy.success,
            error: config.toast?.error || config.copy.error || ((error) => buildErrorToastCopy(error)),
            navigation,
        },
    );

    if (postSuccess.kind === "refresh") {
        runtime.refresh();
    }

    return result;
}
