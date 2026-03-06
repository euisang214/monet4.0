import Link from "next/link";
import { cn } from "@/lib/ui/cn";
import styles from "./SectionTabs.module.css";

export interface SectionTabItem {
    value: string;
    label: string;
    href: string;
    count?: number;
}

interface SectionTabsProps {
    items: SectionTabItem[];
    currentValue: string;
    className?: string;
    "aria-label"?: string;
}

export function SectionTabs({ items, currentValue, className, ...props }: SectionTabsProps) {
    return (
        <nav className={cn(styles.nav, className)} {...props}>
            {items.map((item) => {
                const isActive = item.value === currentValue;
                return (
                    <Link
                        key={item.value}
                        href={item.href}
                        className={cn(styles.tab, isActive && styles.tabActive)}
                        aria-current={isActive ? "page" : undefined}
                    >
                        <span>{item.label}</span>
                        {typeof item.count === "number" ? <span className={styles.count}>{item.count}</span> : null}
                    </Link>
                );
            })}
        </nav>
    );
}
