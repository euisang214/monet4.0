import Link from "next/link";

interface EmptyStateProps {
    title: string;
    description: string;
    actionLabel?: string;
    actionHref?: string;
    badge?: string;
}

export function EmptyState({
    title,
    description,
    actionLabel,
    actionHref,
    badge = "Nothing here yet",
}: EmptyStateProps) {
    return (
        <section className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm text-center max-w-lg mx-auto">
            <p className="text-xs uppercase tracking-wider text-blue-600 mb-3">{badge}</p>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">{title}</h3>
            <p className="text-sm text-gray-600 mb-6">{description}</p>
            {actionLabel && actionHref && (
                <Link href={actionHref} className="btn bg-blue-600 text-white hover:bg-blue-700">
                    {actionLabel}
                </Link>
            )}
        </section>
    );
}
