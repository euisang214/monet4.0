import Link from "next/link";
import { cn } from "@/lib/ui/cn";
import { buttonVariants } from "@/components/ui/primitives/Button";
import { SurfaceCard } from "@/components/ui/composites/SurfaceCard/SurfaceCard";
import styles from "./EmptyState.module.css";

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
    const hasActions = Boolean(actionLabel && actionHref) || Boolean(secondaryActionLabel && secondaryActionHref);

    return (
        <SurfaceCard className={className} padding={layout === "centered" ? "lg" : "md"}>
            <section className={cn(styles.root, layout === "centered" && styles.centered)}>
                <p className={styles.badge}>{badge}</p>
                <h3 className={styles.title}>{title}</h3>
                <p className={styles.description}>{description}</p>
                {hasActions ? (
                    <div className={styles.actions}>
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
                ) : null}
            </section>
        </SurfaceCard>
    );
}
