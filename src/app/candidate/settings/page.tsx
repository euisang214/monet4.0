"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/Button"

export default function CandidateSettingsPage() {
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [interests, setInterests] = useState("")

    useEffect(() => {
        fetch("/api/shared/settings")
            .then(res => res.json())
            .then(data => {
                if (data.data) {
                    setProfile(data.data)
                    setInterests(data.data.interests?.join(", ") || "")
                }
            })
            .finally(() => setLoading(false))
    }, [])

    const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0]) return
        const file = e.target.files[0]

        if (file.size > 5 * 1024 * 1024) {
            alert("File too large. Max 5MB.")
            return
        }

        setUploading(true)
        try {
            // 1. Get presigned URL
            const res = await fetch("/api/candidate/upload/resume", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contentType: file.type }),
            })
            const { data } = await res.json()

            if (!data?.uploadUrl) throw new Error("Failed to get upload URL")

            // 2. Upload to S3
            await fetch(data.uploadUrl, {
                method: "PUT",
                body: file,
                headers: { "Content-Type": file.type },
            })

            // 3. Update profile with public URL
            await fetch("/api/shared/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ resumeUrl: data.publicUrl }),
            })

            // Refresh profile
            setProfile((prev: any) => ({ ...prev, resumeUrl: data.publicUrl }))
            alert("Resume uploaded successfully!")
        } catch (error) {
            console.error(error)
            alert("Upload failed")
        } finally {
            setUploading(false)
        }
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            await fetch("/api/shared/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    interests: interests.split(",").map(s => s.trim()).filter(Boolean),
                }),
            })
            alert("Settings saved!")
        } catch (error) {
            console.error(error)
            alert("Failed to save settings")
        }
    }

    if (loading) return <div className="p-8">Loading...</div>

    return (
        <div className="max-w-2xl mx-auto p-8">
            <h1 className="text-3xl font-bold mb-8">Candidate Settings</h1>

            <section className="mb-12">
                <h2 className="text-xl font-semibold mb-4">Resume</h2>
                <div className="bg-gray-50 p-6 rounded-lg border">
                    {profile?.resumeUrl && (
                        <div className="mb-4">
                            <p className="text-sm text-gray-600 mb-2">Current Resume:</p>
                            <a
                                href={profile.resumeUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 hover:underline"
                            >
                                View Resume
                            </a>
                        </div>
                    )}

                    <label className="block">
                        <span className="sr-only">Upload resume</span>
                        <input
                            type="file"
                            accept=".pdf,.docx"
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
                    {uploading && <p className="text-sm text-gray-500 mt-2">Uploading...</p>}
                </div>
            </section>

            <form onSubmit={handleSave} className="space-y-6">
                <section>
                    <h2 className="text-xl font-semibold mb-4">Profile Details</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Interests (comma separated)</label>
                            <input
                                type="text"
                                value={interests}
                                onChange={(e) => setInterests(e.target.value)}
                                className="w-full p-2 border rounded-md"
                                placeholder="Technology, Design, Finance..."
                            />
                        </div>
                    </div>
                </section>

                <Button type="submit">Save Changes</Button>
            </form>

            <section className="mt-12 pt-8 border-t">
                <h2 className="text-xl font-semibold mb-4">Availability</h2>
                <p className="text-gray-600 mb-4">Manage your availability for bookings.</p>
                {/* Placeholder for availability management - likely a separate page or modal */}
                <Button onClick={() => alert("Availability management coming soon")}>
                    Manage Availability
                </Button>
            </section>
        </div>
    )
}
