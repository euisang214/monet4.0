"use client";

import { useCallback, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { usePathname } from "next/navigation";
import { OAuthProviderIcon } from "@/components/auth/OAuthProviderIcon";
import { appRoutes } from "@/lib/shared/routes";

type Provider = "google" | "linkedin";

interface ProviderStatus {
    hasPassword: boolean;
    providers: {
        google: boolean;
        linkedin: boolean;
    };
    canDisconnect: {
        google: boolean;
        linkedin: boolean;
    };
}

const providerLabels: Record<Provider, string> = {
    google: "Google",
    linkedin: "LinkedIn",
};

export function ProviderConnections() {
    const pathname = usePathname();
    const [status, setStatus] = useState<ProviderStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [busyProvider, setBusyProvider] = useState<Provider | null>(null);
    const [error, setError] = useState("");

    const loadStatus = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const response = await fetch(appRoutes.api.auth.linkedProviders, { cache: "no-store" });
            const payload = (await response.json().catch(() => null)) as
                | { data?: ProviderStatus; error?: string }
                | null;

            if (!response.ok || !payload?.data) {
                throw new Error(payload?.error || "Unable to load provider status");
            }

            setStatus(payload.data);
        } catch (loadError) {
            if (loadError instanceof Error) {
                setError(loadError.message);
            } else {
                setError("Unable to load provider status");
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadStatus();
    }, [loadStatus]);

    const connectProvider = async (provider: Provider) => {
        setBusyProvider(provider);
        setError("");
        await signIn(provider, { callbackUrl: pathname || appRoutes.api.auth.callbackRedirect });
    };

    const disconnectProvider = async (provider: Provider) => {
        setBusyProvider(provider);
        setError("");
        try {
            const response = await fetch(appRoutes.api.auth.linkedProvider(provider), {
                method: "DELETE",
            });

            const payload = (await response.json().catch(() => null)) as
                | { data?: ProviderStatus; error?: string }
                | null;

            if (!response.ok || !payload?.data) {
                throw new Error(
                    payload?.error === "cannot_disconnect_last_method"
                        ? "Cannot disconnect your last login method."
                        : payload?.error || "Unable to disconnect provider"
                );
            }

            setStatus(payload.data);
        } catch (disconnectError) {
            if (disconnectError instanceof Error) {
                setError(disconnectError.message);
            } else {
                setError("Unable to disconnect provider");
            }
        } finally {
            setBusyProvider(null);
        }
    };

    return (
        <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Connected sign-in providers</h2>
            <p className="text-sm text-gray-600 mb-4">
                Connect or disconnect Google and LinkedIn. At least one login method must stay connected.
            </p>

            {error && <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

            {loading || !status ? (
                <p className="text-sm text-gray-500">Loading provider connections...</p>
            ) : (
                <div className="space-y-3">
                    {(["google", "linkedin"] as const).map((provider) => {
                        const connected = status.providers[provider];
                        const canDisconnect = status.canDisconnect[provider];
                        const isBusy = busyProvider === provider;

                        return (
                            <div
                                key={provider}
                                className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-4"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="rounded-md border border-gray-200 bg-white p-2">
                                        <OAuthProviderIcon provider={provider} className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900">{providerLabels[provider]}</p>
                                        <p className="text-sm text-gray-500">
                                            {connected ? "Connected" : "Not connected"}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex-shrink-0">
                                    {connected ? (
                                        <button
                                            type="button"
                                            disabled={isBusy || !canDisconnect}
                                            onClick={() => void disconnectProvider(provider)}
                                            className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-200 disabled:opacity-50"
                                        >
                                            {isBusy ? "Disconnecting..." : "Disconnect"}
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            disabled={isBusy}
                                            onClick={() => void connectProvider(provider)}
                                            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                                        >
                                            {isBusy ? "Connecting..." : "Connect"}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {!status.hasPassword && (
                        <p className="text-xs text-amber-700">
                            No password login is configured on this account. Keep at least one OAuth provider connected.
                        </p>
                    )}
                </div>
            )}
        </section>
    );
}
