"use client";

import { useCallback, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { usePathname } from "next/navigation";
import { OAuthProviderIcon } from "@/components/auth/OAuthProviderIcon";
import { appRoutes } from "@/lib/shared/routes";
import { Button, InlineNotice, SurfaceCard } from "@/components/ui";
import styles from "./AuthForms.module.css";

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
        <SurfaceCard as="section">
            <h2 className={styles.title}>Connected sign-in providers</h2>
            <p className={styles.description}>
                Connect or disconnect Google and LinkedIn. At least one login method must stay connected.
            </p>

            {error && (
                <InlineNotice tone="error" className="mb-4">
                    {error}
                </InlineNotice>
            )}

            {loading || !status ? (
                <p className={styles.description}>Loading provider connections...</p>
            ) : (
                <div className={styles.providerStack}>
                    {(["google", "linkedin"] as const).map((provider) => {
                        const connected = status.providers[provider];
                        const canDisconnect = status.canDisconnect[provider];
                        const isBusy = busyProvider === provider;

                        return (
                            <div
                                key={provider}
                                className={styles.providerCard}
                            >
                                <div className={styles.providerInfo}>
                                    <div className={styles.providerBadge}>
                                        <OAuthProviderIcon provider={provider} className="h-5 w-5" />
                                    </div>
                                    <div className={styles.providerMeta}>
                                        <p className={styles.providerName}>{providerLabels[provider]}</p>
                                        <p className={styles.providerState}>
                                            {connected ? "Connected" : "Not connected"}
                                        </p>
                                    </div>
                                </div>

                                <div className={styles.providerActions}>
                                    {connected ? (
                                        <Button
                                            type="button"
                                            disabled={isBusy || !canDisconnect}
                                            onClick={() => void disconnectProvider(provider)}
                                            variant="secondary"
                                        >
                                            {isBusy ? "Disconnecting..." : "Disconnect"}
                                        </Button>
                                    ) : (
                                        <Button
                                            type="button"
                                            disabled={isBusy}
                                            onClick={() => void connectProvider(provider)}
                                            variant="primary"
                                        >
                                            {isBusy ? "Connecting..." : "Connect"}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {!status.hasPassword && (
                        <p className={styles.warningText}>
                            No password login is configured on this account. Keep at least one OAuth provider connected.
                        </p>
                    )}
                </div>
            )}
        </SurfaceCard>
    );
}
