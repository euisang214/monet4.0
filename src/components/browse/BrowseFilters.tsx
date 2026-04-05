"use client";

import { startTransition, useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/primitives/Button";
import { SurfaceCard } from "@/components/ui/composites/SurfaceCard/SurfaceCard";
import type { ProfessionalFilterOption } from "@/lib/role/candidate/browse";
import styles from "./BrowseFilters.module.css";

type BrowseFiltersProps = {
    industries: ProfessionalFilterOption<string>[];
    companies: ProfessionalFilterOption<string>[];
    seniorities: ProfessionalFilterOption<string>[];
    selectedIndustry?: string;
    selectedCompany?: string;
    selectedSeniority?: string;
};

type FilterKey = "industry" | "company" | "seniority";

type FilterMenuProps = {
    menuKey: FilterKey;
    label: string;
    emptyLabel: string;
    searchPlaceholder: string;
    selectedValue?: string;
    options: ProfessionalFilterOption<string>[];
    isOpen: boolean;
    searchValue: string;
    onOpenChange: (nextMenu: FilterKey | null) => void;
    onSearchChange: (menu: FilterKey, value: string) => void;
    onSelect: (menu: FilterKey, value: string) => void;
};

const EMPTY_SEARCH_STATE: Record<FilterKey, string> = {
    industry: "",
    company: "",
    seniority: "",
};

function FilterMenu({
    menuKey,
    label,
    emptyLabel,
    searchPlaceholder,
    selectedValue,
    options,
    isOpen,
    searchValue,
    onOpenChange,
    onSearchChange,
    onSelect,
}: FilterMenuProps) {
    const panelId = useId();
    const normalizedSearch = searchValue.trim().toLowerCase();
    const visibleOptions = options.filter((option) => {
        if (!normalizedSearch) {
            return true;
        }

        return option.label.toLowerCase().includes(normalizedSearch);
    });
    const selectedLabel = options.find((option) => option.value === selectedValue)?.label ?? emptyLabel;

    return (
        <div className={styles.filter}>
            <button
                type="button"
                className={styles.trigger}
                data-open={isOpen || undefined}
                data-selected={selectedValue ? true : undefined}
                aria-expanded={isOpen}
                aria-haspopup="dialog"
                aria-controls={panelId}
                onClick={() => onOpenChange(isOpen ? null : menuKey)}
            >
                <span className={styles.triggerCopy}>
                    <span className={styles.triggerLabel}>{label}</span>
                    <span className={styles.triggerValue}>{selectedLabel}</span>
                </span>
                <span className={styles.triggerIcon} aria-hidden="true">
                    <ChevronIcon open={isOpen} />
                </span>
            </button>

            {isOpen ? (
                <div id={panelId} className={styles.panel} aria-label={label}>
                    <label className={styles.searchShell}>
                        <SearchIcon />
                        <input
                            className={styles.searchInput}
                            type="text"
                            value={searchValue}
                            onChange={(event) => onSearchChange(menuKey, event.target.value)}
                            placeholder={searchPlaceholder}
                            autoFocus
                        />
                    </label>

                    <div className={styles.optionList}>
                        <button
                            type="button"
                            className={styles.option}
                            data-selected={!selectedValue || undefined}
                            onClick={() => onSelect(menuKey, "")}
                        >
                            <span>{emptyLabel}</span>
                            {!selectedValue ? <CheckIcon /> : null}
                        </button>

                        {visibleOptions.length > 0 ? (
                            visibleOptions.map((option) => {
                                const isSelected = option.value === selectedValue;

                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        className={styles.option}
                                        data-selected={isSelected || undefined}
                                        onClick={() => onSelect(menuKey, option.value)}
                                    >
                                        <span>{option.label}</span>
                                        {isSelected ? <CheckIcon /> : null}
                                    </button>
                                );
                            })
                        ) : (
                            <p className={styles.emptyState}>No matches found.</p>
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    );
}

function SearchIcon() {
    return (
        <svg
            className={styles.searchIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
        </svg>
    );
}

function ChevronIcon({ open }: { open: boolean }) {
    return (
        <svg
            className={styles.chevron}
            data-open={open || undefined}
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="m6 8 4 4 4-4" />
        </svg>
    );
}

function CheckIcon() {
    return (
        <svg
            className={styles.checkIcon}
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="m5 10 3 3 7-7" />
        </svg>
    );
}

export function BrowseFilters({
    industries,
    companies,
    seniorities,
    selectedIndustry,
    selectedCompany,
    selectedSeniority,
}: BrowseFiltersProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [openMenu, setOpenMenu] = useState<FilterKey | null>(null);
    const [searchState, setSearchState] = useState<Record<FilterKey, string>>(EMPTY_SEARCH_STATE);
    const activeFilterCount = [selectedIndustry, selectedCompany, selectedSeniority].filter(Boolean).length;
    const hasActiveFilters = activeFilterCount > 0;

    useEffect(() => {
        function handlePointerDown(event: PointerEvent) {
            if (!containerRef.current?.contains(event.target as Node)) {
                setOpenMenu(null);
            }
        }

        function handleEscape(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setOpenMenu(null);
            }
        }

        document.addEventListener("pointerdown", handlePointerDown);
        document.addEventListener("keydown", handleEscape);

        return () => {
            document.removeEventListener("pointerdown", handlePointerDown);
            document.removeEventListener("keydown", handleEscape);
        };
    }, []);

    const updateFilter = (key: FilterKey, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("cursor");

        if (value) {
            params.set(key, value);
        } else {
            params.delete(key);
        }

        const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
        startTransition(() => {
            router.replace(nextUrl);
        });
    };

    const handleOpenChange = (nextMenu: FilterKey | null) => {
        setOpenMenu(nextMenu);

        if (nextMenu) {
            setSearchState((current) => ({
                ...current,
                [nextMenu]: "",
            }));
        }
    };

    const handleSearchChange = (menu: FilterKey, value: string) => {
        setSearchState((current) => ({
            ...current,
            [menu]: value,
        }));
    };

    const handleSelect = (menu: FilterKey, value: string) => {
        setOpenMenu(null);
        setSearchState((current) => ({
            ...current,
            [menu]: "",
        }));
        updateFilter(menu, value);
    };

    const clearAllFilters = () => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("cursor");
        params.delete("industry");
        params.delete("company");
        params.delete("seniority");
        setOpenMenu(null);
        setSearchState(EMPTY_SEARCH_STATE);
        const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
        startTransition(() => {
            router.replace(nextUrl);
        });
    };

    return (
        <SurfaceCard className={styles.card} data-menu-open={openMenu ? true : undefined}>
            <div className={styles.header}>
                <div className={styles.copy}>
                    <p className={styles.eyebrow}>Refine results</p>
                    <h2 className={styles.title}>Filter professionals</h2>
                    <p className={styles.description}>
                        Use fast-pick menus to narrow by industry, company, or seniority.
                    </p>
                </div>

                <div className={styles.actions}>
                    <p className={styles.summary}>
                        {hasActiveFilters ? `${activeFilterCount} active filter${activeFilterCount === 1 ? "" : "s"}` : "Showing all filters"}
                    </p>
                    {hasActiveFilters ? (
                        <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                            Clear all
                        </Button>
                    ) : null}
                </div>
            </div>

            <div ref={containerRef} className={styles.rail}>
                <FilterMenu
                    menuKey="industry"
                    label="Industry"
                    emptyLabel="All industries"
                    searchPlaceholder="Search industries"
                    selectedValue={selectedIndustry}
                    options={industries}
                    isOpen={openMenu === "industry"}
                    searchValue={searchState.industry}
                    onOpenChange={handleOpenChange}
                    onSearchChange={handleSearchChange}
                    onSelect={handleSelect}
                />
                <FilterMenu
                    menuKey="company"
                    label="Company"
                    emptyLabel="All companies"
                    searchPlaceholder="Search companies"
                    selectedValue={selectedCompany}
                    options={companies}
                    isOpen={openMenu === "company"}
                    searchValue={searchState.company}
                    onOpenChange={handleOpenChange}
                    onSearchChange={handleSearchChange}
                    onSelect={handleSelect}
                />
                <FilterMenu
                    menuKey="seniority"
                    label="Seniority"
                    emptyLabel="All seniority levels"
                    searchPlaceholder="Search seniority"
                    selectedValue={selectedSeniority}
                    options={seniorities}
                    isOpen={openMenu === "seniority"}
                    searchValue={searchState.seniority}
                    onOpenChange={handleOpenChange}
                    onSearchChange={handleSearchChange}
                    onSelect={handleSelect}
                />
            </div>
        </SurfaceCard>
    );
}
