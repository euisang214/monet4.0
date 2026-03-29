import Link from "next/link";
import { buttonVariants } from "@/components/ui/primitives/Button";
import { SurfaceCard } from "@/components/ui/composites/SurfaceCard/SurfaceCard";

interface EmptyStateProps {
    title: string;
    description: string;
    actionLabel?: string;
    actionHref?: string;
    badge?: string;
    secondaryActionLabel?: string;
    secondaryActionHref?: string;
    layout?: "centered" | "inline";
    className?: string;
}

export function EmptyState({
    title,
    description,
    actionLabel,
    actionHref,
    badge = "Nothing here yet",
    secondaryActionLabel,
    secondaryActionHref,
    layout = "centered",
    className,
}: EmptyStateProps) {
    return (
        <SurfaceCard className={className} padding={layout === "centered" ? "lg" : "md"}>
            <section className={layout === "centered" ? "text-center w-full" : "w-full"}>
                <p className="text-xs uppercase tracking-wider text-blue-600 mb-3">{badge}</p>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">{title}</h3>
                <p className="text-sm text-gray-600 mb-6">{description}</p>
                <div className={layout === "centered" ? "flex flex-wrap justify-center gap-3" : "flex flex-wrap gap-3"}>
                    {actionLabel && actionHref ? (
                        <Link href={actionHref} className={buttonVariants()}>
                            {actionLabel}
                        </Link>
                    ) : null}
                    {secondaryActionLabel && secondaryActionHref ? (
                        <Link href={secondaryActionHref} className={buttonVariants({ variant: "secondary" })}>
                            {secondaryActionLabel}
                        </Link>
                    ) : null}
                </div>
            </section>
        </SurfaceCard>
    );
}
