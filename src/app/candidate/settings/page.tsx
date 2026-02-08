"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/primitives/Button";

interface CandidateProfileData {
    resumeUrl?: string | null;
    interests?: string[] | null;
}

type Notification = {
    type: "success" | "error";
    message: string;
} | null;

export default function CandidateSettingsPage() {
    const [profile, setProfile] = useState<CandidateProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [interests, setInterests] = useState("");
    const [notification, setNotification] = useState<Notification>(null);

    useEffect(() => {
        fetch("/api/shared/settings")
            .then((res) => res.json())
            .then((data: { data?: CandidateProfileData | null }) => {
                if (data.data) {
                    setProfile(data.data);
                    setInterests(data.data.interests?.join(", ") || "");
                }
            })
            .catch(() => {
                setNotification({ type: "error", message: "Could not load profile settings." });
            })
            .finally(() => setLoading(false));
    }, []);

    const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            setNotification({ type: "error", message: "File too large. Max size is 5MB." });
            return;
        }

        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        if (!isPdf) {
            setNotification({ type: "error", message: "Resume must be uploaded as a PDF." });
            return;
        }

        setUploading(true);
        setNotification(null);

        try {
            const res = await fetch("/api/candidate/upload/resume", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contentType: file.type, size: file.size }),
            });

            const payload = await res.json();
            const uploadUrl = payload?.data?.uploadUrl as string | undefined;
            const publicUrl = payload?.data?.publicUrl as string | undefined;

            if (!uploadUrl || !publicUrl) {
                throw new Error("Failed to prepare upload");
            }

            await fetch(uploadUrl, {
                method: "PUT",
                body: file,
                headers: { "Content-Type": file.type },
            });

            await fetch("/api/shared/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ resumeUrl: publicUrl }),
            });

            setProfile((prev) => ({ ...(prev || {}), resumeUrl: publicUrl }));
            setNotification({ type: "success", message: "Resume uploaded successfully." });
        } catch (error) {
            console.error(error);
            setNotification({ type: "error", message: "Resume upload failed." });
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setNotification(null);

        try {
            await fetch("/api/shared/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    interests: interests
                        .split(",")
                        .map((value) => value.trim())
                        .filter(Boolean),
                }),
            });
            setNotification({ type: "success", message: "Settings saved." });
        } catch (error) {
            console.error(error);
            setNotification({ type: "error", message: "Failed to save settings." });
        }
    };

    if (loading) {
        return (
            <main className="container py-8">
                <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
                    <p className="text-sm text-gray-600">Loading candidate settings...</p>
                </div>
            </main>
        );
    }

    return (
        <main className="container py-8">
            <div className="max-w-3xl mx-auto">
                <header className="mb-8">
                    <p className="text-xs uppercase tracking-wider text-blue-600 mb-2">Candidate Settings</p>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Profile and preferences</h1>
                    <p className="text-gray-600">
                        Keep your resume and interests up to date so professionals can better tailor sessions.
                    </p>
                </header>

                {notification && (
                    <div className={`mb-6 rounded-md p-4 text-sm ${notification.type === "success"
                        ? "bg-green-50 text-green-700"
                        : "bg-red-50 text-red-700"
                        }`}>
                        {notification.message}
                    </div>
                )}

                <section className="mb-8 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Resume</h2>
                    <p className="text-sm text-gray-600 mb-5">
                        Upload your latest resume to make your background easy to review before consultations.
                    </p>

                    {profile?.resumeUrl ? (
                        <div className="mb-5 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                            <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Current resume</p>
                            <a
                                href={profile.resumeUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm font-medium text-blue-600 hover:underline"
                            >
                                Open uploaded resume
                            </a>
                        </div>
                    ) : (
                        <div className="mb-5 p-4 bg-gray-50 border border-dashed border-gray-300 rounded-lg">
                            <p className="text-sm text-gray-600">No resume uploaded yet.</p>
                        </div>
                    )}

                    <label className="block">
                        <span className="sr-only">Upload resume</span>
                        <input
                            type="file"
                            accept=".pdf,application/pdf"
                            onChange={handleResumeUpload}
                            disabled={uploading}
                            className="block w-full text-sm text-gray-500
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-md file:border-0
                                file:text-sm file:font-semibold
                                file:bg-blue-50 file:text-blue-700
                                hover:file:bg-blue-100"
                        />
                    </label>
                    {uploading && <p className="text-sm text-gray-500 mt-2">Uploading resume...</p>}
                </section>

                <form onSubmit={handleSave} className="space-y-6 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">Interests</h2>
                        <p className="text-sm text-gray-600 mb-4">
                            Separate topics with commas so we can improve matching and recommendations.
                        </p>
                        <label htmlFor="interests" className="block text-sm font-medium mb-1">
                            Interests
                        </label>
                        <input
                            id="interests"
                            type="text"
                            value={interests}
                            onChange={(e) => setInterests(e.target.value)}
                            className="w-full p-2 border rounded-md"
                            placeholder="Technology, Product, Career transitions"
                        />
                    </section>

                    <div className="pt-4 border-t flex justify-between items-center">
                        <Link href="/candidate/availability" className="text-sm font-medium text-gray-600 hover:text-black">
                            Manage availability
                        </Link>
                        <Button type="submit">Save changes</Button>
                    </div>
                </form>
            </div>
        </main>
    );
}
