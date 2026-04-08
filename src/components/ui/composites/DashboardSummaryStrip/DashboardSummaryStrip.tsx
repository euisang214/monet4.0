import Link from "next/link";
import { cn } from "@/lib/ui/cn";
import { MetricCard } from "@/components/ui/composites/MetricCard/MetricCard";
import styles from "./DashboardSummaryStrip.module.css";

export interface DashboardSummaryItem {
    key: string;
    label: string;
    value: string | number;
    subValue?: string;
    href?: string;
}

interface DashboardSummaryStripProps {
    items: DashboardSummaryItem[];
    className?: string;
    "aria-label"?: string;
}

export function DashboardSummaryStrip({ items, className, ...props }: DashboardSummaryStripProps) {
    return (
        <section className={cn(styles.strip, className)} {...props}>
            {items.map((item) => {
                const card = (
                    <MetricCard
                        label={item.label}
                        value={item.value}
                        subValue={item.subValue}
                        className={styles.card}
                    />
                );

                if (item.href) {
                    return (
                        <Link key={item.key} href={item.href} className={styles.link}>
                            {card}
                        </Link>
                    );
                }

                return (
                    <div key={item.key} className={styles.cardWrap}>
                        {card}
                    </div>
                );
            })}
        </section>
    );
}
