"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"

function ProfessionalSettingsPageContent() {
    const searchParams = useSearchParams()
    const router = useRouter()

    // Check for success/error parameters from Stripe redirect
    // Use raw searchParams to avoid component unmounting/remounting issues if params change
    const successParam = searchParams.get("success")
    const errorParam = searchParams.get("error")

    const [profile, setProfile] = useState<any>(null)
    const [user, setUser] = useState<any>(null) // Need User table for Stripe ID
    const [loading, setLoading] = useState(true)
    const [price, setPrice] = useState("")
    const [employer, setEmployer] = useState("")
    const [title, setTitle] = useState("")
    const [bio, setBio] = useState("")
    const [corporateEmail, setCorporateEmail] = useState("")
    const [verificationSent, setVerificationSent] = useState(false)
    const [verificationCode, setVerificationCode] = useState("")
    const [verifying, setVerifying] = useState(false)

    // Derived state for notifications
    const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)

    useEffect(() => {
        if (successParam) {
            setNotification({ type: 'success', message: 'Stripe account connected successfully!' });
            // Clean URL
            router.replace('/professional/settings');
        }
        if (errorParam) {
            setNotification({ type: 'error', message: 'Failed to connect Stripe account.' });
            router.replace('/professional/settings');
        }
    }, [successParam, errorParam, router])


    useEffect(() => {
        // Fetch User and Profile data (mimicked by single endpoint in this simplified impl)
        // In reality, might need two calls or `settings` endpoint returns merged data
        fetch("/api/shared/settings")
            .then(res => res.json())
            .then(data => {
                if (data.data) {
                    setProfile(data.data)
                    setPrice(data.data.price?.toString() || "0")
                    setEmployer(data.data.employer || "")
                    setTitle(data.data.title || "")
                    setBio(data.data.bio || "")
                    setCorporateEmail(data.data.corporateEmail || "")
                }
            })
            .finally(() => setLoading(false))

        // Check verification status (separate or merged)
        // Ignoring separate user fetch for brevity as Settings endpoint could return it
    }, [])

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            await fetch("/api/shared/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    employer,
                    title,
                    bio,
                    price: parseFloat(price),
                }),
            })
            setNotification({ type: 'success', message: 'Profile settings saved!' })
        } catch (error) {
            console.error(error)
            setNotification({ type: 'error', message: 'Failed to save settings.' })
        }
    }

    const handleConnectStripe = async () => {
        try {
            const res = await fetch("/api/professional/onboarding", { method: "POST" })
            const data = await res.json()
            if (data.data?.url) {
                window.location.href = data.data.url
            }
        } catch (error) {
            console.error(error)
            alert("Failed to initiate Stripe connection")
        }
    }

    const handleVerifyEmail = async () => {
        try {
            await fetch("/api/shared/verification/request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ corporateEmail }),
            })
            setVerificationSent(true)
            alert("Verification email sent! Check your inbox.")
        } catch (error) {
            console.error(error)
            alert("Failed to send verification email")
        }
    }

    const handleConfirmVerification = async () => {
        if (!verificationCode) return
        setVerifying(true)
        try {
            const res = await fetch("/api/shared/verification/confirm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: verificationCode }),
            })
            const data = await res.json()
            if (res.ok) {
                setNotification({ type: 'success', message: 'Email verified successfully!' })
                // Update local profile state to reflect verification
                setProfile((prev: any) => ({ ...prev, verifiedAt: new Date().toISOString() }))
                setVerificationSent(false)
            } else {
                setNotification({ type: 'error', message: data.error || 'Verification failed.' })
            }
        } catch (error) {
            console.error(error)
            setNotification({ type: 'error', message: 'Failed to verify code.' })
        } finally {
            setVerifying(false)
        }
    }

    if (loading) return <div className="p-8">Loading...</div>

    return (
        <div className="max-w-3xl mx-auto p-8">
            <h1 className="text-3xl font-bold mb-8">Professional Settings</h1>

            {notification && (
                <div className={`p-4 mb-6 rounded ${notification.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {notification.message}
                </div>
            )}

            <section className="mb-12 bg-white p-6 rounded-lg shadow-sm border">
                <h2 className="text-xl font-semibold mb-4">Payouts</h2>
                <p className="text-gray-600 mb-4">Connect your Stripe account to receive payouts from bookings.</p>

                {/* 
                   In a real app, check profile.user.stripeAccountId 
                   Since our GET /settings returns limited fields, we assume logic based on what's available
                   For now, just showing the button to trigger/update connection
                */}
                <Button onClick={handleConnectStripe} className="bg-indigo-600 hover:bg-indigo-700">
                    {profile?.user?.stripeAccountId ? "Manage Stripe Account" : "Connect Stripe for Payouts"}
                </Button>
            </section>

            <form onSubmit={handleSave} className="space-y-8 bg-white p-6 rounded-lg shadow-sm border">
                <section>
                    <h2 className="text-xl font-semibold mb-6">Profile Details</h2>

                    <div className="grid grid-cols-1 gap-6">
                        <div>
                            <label className="block text-sm font-medium mb-1">Current Employer</label>
                            <input
                                type="text"
                                value={employer}
                                onChange={(e) => setEmployer(e.target.value)}
                                className="w-full p-2 border rounded-md"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Job Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full p-2 border rounded-md"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Hourly Rate ($)</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                className="w-full p-2 border rounded-md"
                            />
                            <p className="text-xs text-gray-500 mt-1">Platform fee of 20% will be deducted.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Bio</label>
                            <textarea
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                className="w-full p-2 border rounded-md h-32"
                            />
                        </div>
                    </div>
                </section>

                <section className="pt-6 border-t">
                    <h2 className="text-xl font-semibold mb-4">Verification</h2>
                    <div className="flex gap-4 items-end">
                        <div className="flex-1">
                            <label className="block text-sm font-medium mb-1">Corporate Email</label>
                            <input
                                type="email"
                                value={corporateEmail}
                                onChange={(e) => setCorporateEmail(e.target.value)}
                                className="w-full p-2 border rounded-md"
                            />
                        </div>
                        <Button
                            type="button"
                            onClick={handleVerifyEmail}
                            disabled={verificationSent}
                        >
                            {verificationSent ? "Sent!" : "Verify Email"}
                        </Button>
                    </div>
                    {profile?.verifiedAt ? (
                        <p className="text-green-600 text-sm mt-2">✓ Verified on {new Date(profile.verifiedAt).toLocaleDateString()}</p>
                    ) : (
                        <div className="mt-4">
                            {verificationSent && (
                                <div className="mt-4 p-4 bg-gray-50 rounded border">
                                    <label className="block text-sm font-medium mb-1">Enter Verification Code</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={verificationCode}
                                            onChange={(e) => setVerificationCode(e.target.value)}
                                            className="flex-1 p-2 border rounded-md"
                                            placeholder="XXXXXX"
                                        />
                                        <Button
                                            type="button"
                                            onClick={handleConfirmVerification}
                                            disabled={verifying || !verificationCode}
                                        >
                                            {verifying ? "Verifying..." : "Confirm"}
                                        </Button>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">Check your inbox for the code.</p>
                                </div>
                            )}
                        </div>
                    )}
                </section>

                <div className="pt-6 border-t flex justify-end">
                    <Button type="submit">Save Settings</Button>
                </div>
            </form>
        </div>
    )
}

export default function ProfessionalSettingsPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ProfessionalSettingsPageContent />
        </Suspense>
    )
}
