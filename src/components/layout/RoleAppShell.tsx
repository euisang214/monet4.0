"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/ui/cn";
import styles from "./RoleAppShell.module.css";

export interface SectionNavItem {
    href: string;
    label: string;
    match?: "exact" | "prefix";
}

interface SectionNavProps {
    items: SectionNavItem[];
    orientation?: "mobile" | "desktop";
}

interface RoleAppShellProps {
    title?: string;
    description?: string;
    navItems: SectionNavItem[];
    children: React.ReactNode;
}

function isActivePath(pathname: string, item: SectionNavItem) {
    if (item.match === "exact") {
        return pathname === item.href;
    }

    return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function SectionNav({ items, orientation = "mobile" }: SectionNavProps) {
    const pathname = usePathname();
    const orientationClass = orientation === "mobile" ? styles.sectionNavMobile : styles.sectionNavDesktop;

    return (
        <nav className={cn(styles.sectionNav, orientationClass)} aria-label="Section navigation">
            {items.map((item) => {
                const active = isActivePath(pathname, item);

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(styles.sectionLink, active && styles.sectionLinkActive)}
                        aria-current={active ? "page" : undefined}
                    >
                        {item.label}
                    </Link>
                );
            })}
        </nav>
    );
}

export function RoleAppShell({ title, description, navItems, children }: RoleAppShellProps) {
    const hasIntro = Boolean(title || description);

    return (
        <div className={styles.shell}>
            <div className={styles.frame} data-page-shell="true">
                <div className={styles.mobileNav}>
                    <SectionNav items={navItems} orientation="mobile" />
                </div>
                <div className={styles.desktopLayout}>
                    <aside className={styles.rail}>
                        <div className={cn(styles.railCard, !hasIntro && styles.railCardCompact)}>
                            {hasIntro ? (
                                <div>
                                    {title ? <p className={styles.railTitle}>{title}</p> : null}
                                    {description ? <p className={styles.sectionMeta}>{description}</p> : null}
                                </div>
                            ) : null}
                            <SectionNav items={navItems} orientation="desktop" />
                        </div>
                    </aside>
                    <div className={styles.content}>{children}</div>
                </div>
            </div>
        </div>
    );
}
