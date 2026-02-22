"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useNotification } from "@/components/ui/hooks/useNotification";
import { NotificationBanner } from "@/components/ui/composites/NotificationBanner";
import { ProviderConnections } from "@/components/auth/ProviderConnections";
import { appRoutes } from "@/lib/shared/routes";
import {
    CandidateProfileEditor,
    CandidateProfileEditorInitialData,
    CandidateProfileSubmitPayload,
} from "@/components/profile/CandidateProfileEditor";

export default function CandidateSettingsPage() {
    const [profile, setProfile] = useState<CandidateProfileEditorInitialData | null>(null);
    const [loading, setLoading] = useState(true);
    const { notification, notify, clear } = useNotification();

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
                }
            } catch {
                if (isMounted) {
                    notify("error", "Could not load profile settings.");
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
    }, [fetchSettings, notify]);

    const handleSave = async (payload: CandidateProfileSubmitPayload) => {
        clear();

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
        notify("success", "Settings saved.");
    };

    if (loading) {
        return (
            <main className="container py-8">
                <div className="max-w-4xl mx-auto bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
                    <p className="text-sm text-gray-600">Loading candidate settings...</p>
                </div>
            </main>
        );
    }

    return (
        <main className="container py-8">
            <div className="max-w-4xl mx-auto">
                <header className="mb-8">
                    <p className="text-xs uppercase tracking-wider text-blue-600 mb-2">Candidate Settings</p>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Profile and preferences</h1>
                    <p className="text-gray-600">
                        Keep your profile updated so professionals can tailor sessions to your background and goals.
                    </p>
                </header>

                <NotificationBanner notification={notification} />

                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <CandidateProfileEditor
                        mode="settings"
                        initialData={profile || undefined}
                        submitLabel="Save changes"
                        submittingLabel="Saving..."
                        onSubmit={handleSave}
                    />
                </div>

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
