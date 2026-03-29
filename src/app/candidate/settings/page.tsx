"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ProviderConnections } from "@/components/auth/ProviderConnections";
import { appRoutes } from "@/lib/shared/routes";
import { InlineNotice, LoadingCard, PageHeader, SurfaceCard } from "@/components/ui";
import {
    CandidateProfileEditor,
    CandidateProfileEditorInitialData,
    CandidateProfileSubmitPayload,
} from "@/components/profile/CandidateProfileEditor";

export default function CandidateSettingsPage() {
    const [profile, setProfile] = useState<CandidateProfileEditorInitialData | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const fetchSettings = useCallback(async () => {
        const response = await fetch(appRoutes.api.shared.settings);
        const payload = (await response.json().catch(() => null)) as
            | { data?: CandidateProfileEditorInitialData | null }
            | null;

        if (!response.ok) {
            throw new Error("Could not load profile settings");
        }

        return payload?.data || null;
    }, []);

    useEffect(() => {
        let isMounted = true;

        const initialize = async () => {
            try {
                const initialSettings = await fetchSettings();
                if (isMounted) {
                    setProfile(initialSettings);
                    setLoadError(null);
                }
            } catch {
                if (isMounted) {
                    setLoadError("Could not load profile settings.");
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        void initialize();

        return () => {
            isMounted = false;
        };
    }, [fetchSettings]);

    const handleSave = async (payload: CandidateProfileSubmitPayload) => {
        const response = await fetch(appRoutes.api.shared.settings, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        const responsePayload = (await response.json().catch(() => null)) as
            | { error?: string; details?: { fieldErrors?: Record<string, string[]> } }
            | null;

        if (!response.ok) {
            if (responsePayload?.error === "validation_error") {
                throw new Error("Review required candidate fields and try again.");
            }

            throw new Error(responsePayload?.error || "Could not save candidate settings");
        }

        const refreshedSettings = await fetchSettings();
        setProfile(refreshedSettings);
    };

    if (loading) {
        return (
            <main className="space-y-8">
                <LoadingCard
                    className="max-w-4xl mx-auto"
                    title="Loading candidate settings"
                    description="Preparing your profile and preferences."
                />
            </main>
        );
    }

    return (
        <main className="space-y-8">
            <div className="max-w-4xl mx-auto">
                <PageHeader
                    eyebrow="Candidate settings"
                    title="Profile and preferences"
                    description="Keep your profile updated so professionals can tailor sessions to your background and goals."
                    className="mb-8"
                />

                {loadError ? (
                    <InlineNotice tone="error" title="Load failed" className="mb-6">
                        {loadError}
                    </InlineNotice>
                ) : null}

                <SurfaceCard>
                    <CandidateProfileEditor
                        mode="settings"
                        initialData={profile || undefined}
                        submitLabel="Save changes"
                        submittingLabel="Saving..."
                        onSubmit={handleSave}
                        asyncStatus={{
                            pending: {
                                title: "Saving candidate settings",
                                message: "Updating your profile and preferences.",
                            },
                            success: {
                                title: "Candidate settings saved",
                                message: "Your profile changes are now live.",
                            },
                        }}
                    />
                </SurfaceCard>

                <div className="mt-4">
                    <Link href={appRoutes.candidate.availability} className="text-sm font-medium text-gray-600 hover:text-black">
                        Manage availability
                    </Link>
                </div>

                <div className="mt-8">
                    <ProviderConnections />
                </div>
            </div>
        </main>
    );
}
