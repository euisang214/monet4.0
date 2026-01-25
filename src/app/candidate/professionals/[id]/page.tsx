import React from 'react';
import { auth } from '@/auth';
import { CandidateBrowse } from '@/lib/role/candidate/browse';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { QCService } from '@/lib/domain/qc/services';

export default async function ProfessionalProfilePage(props: {
    params: Promise<{ id: string }>;
}) {
    const params = await props.params;
    const session = await auth();
    if (!session?.user) {
        redirect(`/auth/signin?callbackUrl=/candidate/professionals/${params.id}`);
    }

    const profile = await CandidateBrowse.getProfessionalDetails(params.id, session.user.id);

    if (!profile) {
        notFound();
    }

    // Fetch reviews separate if not included in profile (Service usually returns just profile data)
    const reviews = await CandidateBrowse.getProfessionalReviews(params.id);

    // Determine display name logic - simplified for now, usually handled by domain service redaction
    // The service.ts `getProfessionalProfile` handles redaction based on booking history.
    // We just display what is returned.

    return (
        <div className="container mx-auto py-8 max-w-4xl">
            <Link href="/candidate/browse" className="text-sm text-gray-500 hover:text-gray-900 mb-6 inline-block">
                &larr; Back to Browse
            </Link>

            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="md:flex">
                    {/* Left Column: Info */}
                    <div className="p-8 md:w-2/3">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900 mb-1">
                                    {profile.title}
                                </h1>
                                <div className="text-lg text-gray-600 font-medium">
                                    {profile.employer}
                                </div>
                            </div>
                            <div className="text-2xl font-bold text-green-700 bg-green-50 px-4 py-2 rounded-lg">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((profile.priceCents || 0) / 100)}
                            </div>
                        </div>

                        <div className="prose max-w-none text-gray-700 mb-8">
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">About</h3>
                            <p className="whitespace-pre-line">{profile.bio}</p>
                        </div>

                        {/* Reviews Section */}
                        <div className="border-t pt-8">
                            <h3 className="text-xl font-bold mb-6">Reviews ({reviews.length})</h3>
                            {reviews.length === 0 ? (
                                <p className="text-gray-500 italic">No reviews yet.</p>
                            ) : (
                                <div className="space-y-6">
                                    {reviews.map((review: any) => (
                                        <div key={review.bookingId} className="bg-gray-50 p-4 rounded-lg">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="flex text-yellow-400">
                                                    {[...Array(5)].map((_, i) => (
                                                        <span key={i}>{i < review.rating ? '★' : '☆'}</span>
                                                    ))}
                                                </div>
                                                <span className="text-gray-500 text-sm">
                                                    {new Date(review.submittedAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <p className="text-gray-700">{review.text}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: CTA */}
                    <div className="md:w-1/3 bg-gray-50 p-8 border-l border-gray-100 flex flex-col">
                        <div className="sticky top-8">
                            <h3 className="text-lg font-semibold mb-4">Ready to book?</h3>
                            <p className="text-gray-600 mb-6 text-sm">
                                Schedule a consultation with {profile.title} to discuss your career goals.
                            </p>

                            <Link
                                href={`/candidate/book/${params.id}`}
                                className="block w-full bg-blue-600 text-white text-center py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm hover:shadow-md"
                            >
                                Book Now
                            </Link>

                            <p className="text-xs text-center text-gray-500 mt-4">
                                Secure payment via Stripe. Satisfaction guaranteed.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
}
